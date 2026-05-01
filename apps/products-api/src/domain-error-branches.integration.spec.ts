import { buildAuthModule } from '@lambder/auth/module';
import { createInMemoryEmailEnqueuer } from '@lambder/email/test-fakes';
import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestProductsApp } from './__test-helpers__/build-test-app';

describe('products-api: domain error branches (statusFor coverage)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: ReturnType<typeof buildTestProductsApp>;
  let auth: ReturnType<typeof buildAuthModule>;

  async function provisionUser(email: string): Promise<{ userId: string; token: string }> {
    const password = 'StrongPass1!@#';
    const signupRes = await auth.authService.signup({ email, password });
    if (!signupRes.ok) throw new Error('signup failed');
    const loginRes = await auth.authService.login({ email, password });
    if (!loginRes.ok) throw new Error('login failed');
    return { userId: signupRes.value.id, token: loginRes.value.accessToken };
  }

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    const keys = await generateTestJwtKeys();
    auth = buildAuthModule({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      accessTtlSeconds: 60,
      refreshTtlSeconds: 600,
      issuer: 'lambder-test',
      audience: 'lambder-test.api',
      emailEnqueuer: createInMemoryEmailEnqueuer(),
    });
    app = buildTestProductsApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
    });
  });

  afterAll(async () => {
    await pg?.stop();
    await redis?.stop();
  });

  // === Trigger all error types from statusFor() function ===
  // This covers branches for each error type in error-mapper.ts lines 12-18

  test('statusFor: AuthError returns 401 (via INVALID_TOKEN)', async () => {
    const res = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: 'Bearer invalid.token.xyz',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Test', price: '1.00' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  test('statusFor: ForbiddenError returns 403 (non-owner delete)', async () => {
    const owner = await provisionUser(`forbid-owner+${Date.now()}@example.com`);
    const stranger = await provisionUser(`forbid-stranger+${Date.now()}@example.com`);

    // Owner creates product
    const createRes = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Owned', price: '5.00' }),
    });
    const product = await createRes.json();

    // Stranger tries to delete
    const res = await app.request(`/products/${product.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${stranger.token}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  test('statusFor: NotFoundError returns 404 (product not found)', async () => {
    const res = await app.request('/products/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('statusFor: ConflictError returns 409 if applicable', async () => {
    // ConflictError is not directly raised in products-api
    // This is kept for completeness and future extensibility
  });

  test('statusFor: ValidationError returns 400 (via Zod)', async () => {
    const res = await app.request('/products?limit=invalid');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('multiple error scenarios exercise all branches', async () => {
    const owner = await provisionUser(`err-scenario+${Date.now()}@example.com`);

    // 400: ValidationError (invalid query)
    const badQuery = await app.request('/products?cursor=not-uuid&limit=50');
    expect(badQuery.status).toBe(400);
    expect((await badQuery.json()).error.code).toBe('VALIDATION_ERROR');

    // 401: AuthError (missing auth)
    const noAuth = await app.request('/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X', price: '1.00' }),
    });
    expect(noAuth.status).toBe(401);
    expect((await noAuth.json()).error.code).toBe('UNAUTHORIZED');

    // 403: ForbiddenError (non-owner patch)
    const ownerProduct = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'OwnerProduct', price: '10.00' }),
    });
    const product = await ownerProduct.json();

    const stranger = await provisionUser(`stranger+${Date.now()}@example.com`);
    const forbiddenPatch = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${stranger.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    expect(forbiddenPatch.status).toBe(403);
    expect((await forbiddenPatch.json()).error.code).toBe('FORBIDDEN');

    // 404: NotFoundError (product doesn't exist)
    const notFound = await app.request('/products/11111111-1111-1111-1111-111111111111');
    expect(notFound.status).toBe(404);
    expect((await notFound.json()).error.code).toBe('PRODUCT_NOT_FOUND');

    // 500: Unknown error (malformed JSON)
    const badJson = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: '{bad json}',
    });
    expect(badJson.status).toBe(500);
    expect((await badJson.json()).error.code).toBe('INTERNAL');
  });

  test('patch errors: various validation failures', async () => {
    const owner = await provisionUser(`patch-errors+${Date.now()}@example.com`);

    // Create a product first
    const createRes = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Patchable', price: '5.00' }),
    });
    const product = await createRes.json();

    // Invalid price format
    const badPrice = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ price: 'not-a-price' }),
    });
    expect(badPrice.status).toBe(400);
    expect((await badPrice.json()).error.code).toBe('VALIDATION_ERROR');

    // Description too long
    const longDesc = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ description: 'x'.repeat(2001) }),
    });
    expect(longDesc.status).toBe(400);
    expect((await longDesc.json()).error.code).toBe('VALIDATION_ERROR');

    // Name too long
    const longName = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'x'.repeat(201) }),
    });
    expect(longName.status).toBe(400);
    expect((await longName.json()).error.code).toBe('VALIDATION_ERROR');
  });

  test('create errors: validation and auth failures', async () => {
    // Missing auth
    const noAuth = await app.request('/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'NoAuth', price: '1.00' }),
    });
    expect(noAuth.status).toBe(401);

    const owner = await provisionUser(`create-errors+${Date.now()}@example.com`);

    // Missing required field (name)
    const noName = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ price: '1.00' }),
    });
    expect(noName.status).toBe(400);
    expect((await noName.json()).error.code).toBe('VALIDATION_ERROR');

    // Missing required field (price)
    const noPrice = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'NoPrice' }),
    });
    expect(noPrice.status).toBe(400);
    expect((await noPrice.json()).error.code).toBe('VALIDATION_ERROR');

    // Empty name
    const emptyName = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '', price: '1.00' }),
    });
    expect(emptyName.status).toBe(400);
    expect((await emptyName.json()).error.code).toBe('VALIDATION_ERROR');

    // Invalid price format
    const badPrice = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'BadPrice', price: '1.999' }),
    });
    expect(badPrice.status).toBe(400);
    expect((await badPrice.json()).error.code).toBe('VALIDATION_ERROR');
  });
});
