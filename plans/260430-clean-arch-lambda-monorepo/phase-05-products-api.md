# Phase 05 — Products API (CRUD with JWT guard)

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-04](./phase-04-auth-api.md)

## Overview
- **Priority**: P0
- **Status**: Not started
- Second Lambda app: `apps/products-api`. CRUD over `products` table with ownership enforcement. Reuses JWT verification + Redis whitelist from `@lambder/infra`.

## Key Insights
- Read endpoints (`GET /products`, `GET /products/:id`) are **public** per spec — only `POST/PUT/PATCH/DELETE` require JWT.
- Ownership rule: a user can only update/delete products where `owner_id = sub` from their JWT. Enforced in the use case, not the handler.
- `price` stored as `price_cents: integer` to avoid floating-point math; API DTO exposes decimal string.

## Requirements
- Functional
  - `GET /products` — list (pagination: `?limit=20&cursor=…`); public
  - `GET /products/:id` — public
  - `POST /products` — auth required; body validated; returns 201
  - `PATCH /products/:id` — auth required; ownership check; partial update
  - `DELETE /products/:id` — auth required; ownership check; 204
- Non-functional
  - List endpoint paginated; max `limit` = 100
  - Validation via Zod from `@lambder/contracts`

## Architecture

### App layout
```
apps/products-api/
├── src/
│   ├── handler.ts
│   ├── app.ts
│   ├── routes/
│   │   ├── list-products.ts
│   │   ├── get-product.ts
│   │   ├── create-product.ts
│   │   ├── update-product.ts
│   │   └── delete-product.ts
│   ├── middleware/
│   │   ├── error-mapper.ts        # shared via @lambder/infra later if duplicated
│   │   └── jwt-auth.ts            # imported from @lambder/infra/middleware
│   └── di.ts
├── rolldown.config.ts
├── serverless.yml
└── package.json
```

### Auth middleware reuse
Move `middleware/jwt-auth.ts` to a tiny helper inside `packages/infra/src/http/hono-jwt-middleware.ts` so both apps consume it:
```ts
export const honoJwtAuth = (deps: { jwt: JwtService; tokens: TokenStore }) =>
  async (c: Context, next: Next) => {
    const header = c.req.header('authorization') ?? '';
    if (!header.startsWith('Bearer ')) return c.json({ error: { code: 'UNAUTHORIZED' } }, 401);
    const token = header.slice(7);
    const { payload } = await deps.jwt.verify(token).catch(() => ({ payload: null as any }));
    if (!payload) return c.json({ error: { code: 'UNAUTHORIZED' } }, 401);
    const ok = await deps.tokens.isWhitelisted(payload.sub!, payload.jti!);
    if (!ok) return c.json({ error: { code: 'UNAUTHORIZED' } }, 401);
    c.set('userId', payload.sub);
    await next();
  };
```

### Use cases (shape)
```ts
// packages/core/src/use-cases/products/create-product.ts
export const createProduct = (deps: { products: ProductRepository; clock: Clock }) =>
  async (input: { ownerId: string; data: CreateProductInput }): Promise<Product> => { /* ... */ };

// update-product.ts
export const updateProduct = (deps) => async (input: { actorId: string; id: string; patch }) => {
  const existing = await deps.products.findById(input.id);
  if (!existing) return err(new NotFoundError('PRODUCT_NOT_FOUND', '...'));
  if (existing.ownerId !== input.actorId) return err(new AuthError('FORBIDDEN', '...'));
  return ok(await deps.products.update(input.id, input.patch));
};
```

### Contracts
```ts
// packages/contracts/src/product-schemas.ts
export const createProductBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/), // decimal as string → cents in mapper
});
export const updateProductBody = createProductBody.partial();
export const listProductsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
```

## Files to Create
- `apps/products-api/package.json`
- `apps/products-api/src/handler.ts`, `app.ts`, `di.ts`
- `apps/products-api/src/routes/{list,get,create,update,delete}-products.ts`
- `packages/infra/src/http/hono-jwt-middleware.ts`
- `packages/contracts/src/product-schemas.ts`
- `packages/core/src/use-cases/products/{create,update,delete,get,list}-product.ts`
- `packages/core/src/ports/product-repository.ts`
- `packages/infra/src/repositories/drizzle-product-repository.ts` (real impl from phase 03 stub)

## Implementation Steps
1. Add product Zod schemas in `contracts`.
2. Implement product use cases (with Result types + ownership enforcement).
3. Implement `DrizzleProductRepository` with cursor pagination (`WHERE id > :cursor ORDER BY id LIMIT :n`).
4. Build Hono routes; `app.use('/products/*', honoJwtAuth(deps))` only for the mutating routes (use `app.post('/products', honoJwtAuth(...), handler)`).
5. Wire `di.ts` and `handler.ts` (mirrors auth-api).
6. Local dev: spin up app on `localhost:3002`, run end-to-end with token from auth-api.

## Todo List
- [ ] Product Zod contracts
- [ ] 5 product use cases + tests
- [ ] DrizzleProductRepository real implementation
- [ ] Hono JWT middleware moved to `@lambder/infra`
- [ ] 5 Hono routes + ownership tests
- [ ] Local end-to-end: signup → login → create → update → delete

## Success Criteria
- All 5 endpoints reachable; mutating endpoints require `Authorization: Bearer …`
- Forbidden update/delete (different user) returns 403
- Pagination works (10 items, limit=3, walk cursor 4 times)
- 100% of business rules covered by core unit tests

## Risk Assessment
| Risk | Mitigation |
|---|---|
| N+1 queries on list | List query is single SELECT — verified in tests with `pg` query log |
| Cursor pagination ambiguous on equal `created_at` | Use `id` (uuid v7 ordered) as the cursor, not `created_at` |

## Security Considerations
- All write paths validate ownership in the use case (defence-in-depth — even if route forgets the guard).
- Decimal price parsing rejects negative values (`min: 0` in Zod).
- 404 returned when target product isn't owned by the user (don't reveal existence).

## Next Steps
- Phase 06 makes the bundles deployable.
