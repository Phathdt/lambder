# Phase 02 — Shared Packages (core / infra / contracts)

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-01](./phase-01-monorepo-bootstrap.md)

## Overview
- **Priority**: P0
- **Status**: Not started
- Establish the **Clean Architecture** boundary inside three reusable workspace packages so that `apps/auth-api` and `apps/products-api` only contain HTTP adapters and DI wiring.

## Key Insights
- Domain layer must be **dependency-free** (no `pg`, no `redis`, no `aws-sdk`) — only Node std + Zod allowed.
- Use **ports & adapters**: `core` defines interfaces (`UserRepository`, `TokenStore`, `Hasher`, `Clock`), `infra` provides concrete implementations.
- Zod schemas in `contracts` are the single source of truth for both runtime validation and TS types (`z.infer`).

## Requirements
- Functional
  - `@lambder/core` exports entities + use cases + port interfaces
  - `@lambder/infra` exports concrete adapters that implement core ports
  - `@lambder/contracts` exports Zod schemas + inferred DTOs for both APIs
- Non-functional
  - `core` has zero runtime deps except `zod` (and only via `contracts`)
  - 100% pure functions where possible (use cases return Result types, no exceptions for domain errors)

## Architecture

### Package layout
```
packages/
├── core/
│   └── src/
│       ├── domain/
│       │   ├── user.ts                    # User entity + factory
│       │   └── product.ts                 # Product entity
│       ├── ports/
│       │   ├── user-repository.ts
│       │   ├── product-repository.ts
│       │   ├── token-store.ts             # Redis whitelist port
│       │   ├── hasher.ts
│       │   └── clock.ts
│       ├── use-cases/
│       │   ├── auth/
│       │   │   ├── signup.ts
│       │   │   ├── login.ts
│       │   │   ├── logout.ts
│       │   │   └── refresh-token.ts
│       │   └── products/
│       │       ├── create-product.ts
│       │       ├── update-product.ts
│       │       ├── delete-product.ts
│       │       ├── get-product.ts
│       │       └── list-products.ts
│       ├── shared/
│       │   ├── result.ts                  # Result<T, E> type
│       │   └── errors.ts                  # DomainError hierarchy
│       └── index.ts
├── infra/
│   └── src/
│       ├── db/
│       │   ├── client.ts                  # Drizzle + pg Pool factory
│       │   └── schema/                    # Drizzle table definitions (Phase 03)
│       ├── repositories/
│       │   ├── drizzle-user-repository.ts
│       │   └── drizzle-product-repository.ts
│       ├── cache/
│       │   ├── redis-client.ts
│       │   └── redis-token-store.ts       # implements TokenStore port
│       ├── crypto/
│       │   ├── argon2-hasher.ts
│       │   └── jose-jwt-service.ts
│       ├── system/
│       │   └── system-clock.ts
│       ├── config/
│       │   └── env.ts                     # Zod-validated env loader
│       └── index.ts
└── contracts/
    └── src/
        ├── auth-schemas.ts                # signupBody, loginBody, etc.
        ├── product-schemas.ts             # createProductBody, etc.
        ├── error-schemas.ts               # ApiErrorResponse
        └── index.ts
```

### Naming examples
```ts
// packages/core/src/ports/user-repository.ts
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: NewUser): Promise<User>;
}

// packages/core/src/use-cases/auth/login.ts
export type LoginDeps = {
  users: UserRepository;
  hasher: Hasher;
  tokens: TokenStore;
  jwt: JwtService;
  clock: Clock;
};
export const login = (deps: LoginDeps) => async (input: LoginInput): Promise<Result<LoginOutput, AuthError>> => { /* ... */ };
```

## Files to Create
- `packages/core/package.json` (`name: "@lambder/core"`, deps: `zod`)
- `packages/infra/package.json` (deps: `pg`, `drizzle-orm`, `ioredis`, `argon2`, `jose`)
- `packages/contracts/package.json` (deps: `zod`)
- All `.ts` files listed in the package layout above (skeleton with TODOs; concrete bodies fleshed out in phases 03-05)
- One `tsconfig.json` per package extending `@lambder/tsconfig/lib.json`

## Implementation Steps
1. Create `packages/contracts` first — schemas don't depend on anything else.
2. Create `packages/core` with all port interfaces + entity types + Result/error helpers + use-case **signatures** (function bodies are TODO stubs throwing `not implemented`).
3. Create `packages/infra` with adapter **classes** that take their deps via constructor; bodies stubbed.
4. Add a tiny **DI factory** at `packages/infra/src/composition-root.ts` that builds all adapters from env config — apps will import this.
5. Wire all packages into `pnpm-workspace.yaml` (already done in phase 01); verify `pnpm install` resolves cross-package deps.

### Result type (concise)
```ts
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });
```

### Error hierarchy
```ts
export class DomainError extends Error { constructor(public code: string, message: string) { super(message); } }
export class AuthError extends DomainError {}
export class NotFoundError extends DomainError {}
export class ConflictError extends DomainError {}
```

## Todo List
- [ ] Scaffold `packages/contracts` with empty Zod files + `index.ts`
- [ ] Scaffold `packages/core` with ports + entities + Result helpers
- [ ] Scaffold `packages/infra` with adapter class skeletons
- [ ] Add `composition-root.ts` factory
- [ ] `pnpm typecheck` passes across all three packages

## Success Criteria
- `import { login } from '@lambder/core'` works from a sibling package
- `core` has zero runtime imports of `pg`, `redis`, `argon2`, etc. (verify with `grep -r` on `packages/core/src`)
- Type-checking the use-case signatures forces apps to provide every port

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Over-engineering DI for two endpoints | Keep `composition-root.ts` plain functions, no DI container |
| Circular imports between core and infra | Lint rule: `core` may not import `infra` (Biome `noRestrictedImports`) |

## Security Considerations
- `Hasher` port abstracts argon2 so we can swap algorithms; salt/pepper handled inside infra adapter, not in core.
- Tokens are opaque strings at the core boundary — JWT details stay in infra.

## Next Steps
- Phase 03 fills in Drizzle schema + Redis client implementations.
