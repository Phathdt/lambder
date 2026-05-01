import type { JwtService, TokenStore } from '@lambder/auth';
import { createProductBody, listProductsQuery, updateProductBody } from '@lambder/contracts';
import type { ProductsModule } from '@lambder/products';
import { toProductDto } from '@lambder/products';
import { isErr } from '@lambder/shared-kernel';
import { Hono } from 'hono';
import { mapError } from '../middleware/error-mapper';
import { jwtAuth } from '../middleware/jwt-auth';

export interface ProductsRouteDeps {
  products: ProductsModule;
  jwt: JwtService;
  tokens: TokenStore;
}

export const productsRoute = (deps: ProductsRouteDeps) => {
  const app = new Hono();
  const guard = jwtAuth({ jwt: deps.jwt, tokens: deps.tokens });

  // Public: list + get
  app.get('/', async (c) => {
    let query;
    try {
      query = listProductsQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    } catch (e) {
      return mapError(e, c);
    }
    const page = await deps.products.products.list(query);
    return c.json({
      items: page.items.map(toProductDto),
      nextCursor: page.nextCursor,
    });
  });

  app.get('/:id', async (c) => {
    const result = await deps.products.products.get(c.req.param('id')!);
    if (isErr(result)) return mapError(result.error, c);
    return c.json(toProductDto(result.value));
  });

  // Authenticated: create / update / delete
  app.post('/', guard, async (c) => {
    let body;
    try {
      body = createProductBody.parse(await c.req.json());
    } catch (e) {
      return mapError(e, c);
    }
    const ownerId = c.get('userId') as string;
    const product = await deps.products.products.create({ ...body, ownerId });
    return c.json(toProductDto(product), 201);
  });

  app.patch('/:id', guard, async (c) => {
    let patch;
    try {
      patch = updateProductBody.parse(await c.req.json());
    } catch (e) {
      return mapError(e, c);
    }
    const actorId = c.get('userId') as string;
    const result = await deps.products.products.update({
      actorId,
      id: c.req.param('id')!,
      patch: patch as { name?: string; description?: string | undefined; price?: string },
    });
    if (isErr(result)) return mapError(result.error, c);
    return c.json(toProductDto(result.value));
  });

  app.delete('/:id', guard, async (c) => {
    const actorId = c.get('userId') as string;
    const result = await deps.products.products.delete({ actorId, id: c.req.param('id')! });
    if (isErr(result)) return mapError(result.error, c);
    return c.body(null, 204);
  });

  return app;
};
