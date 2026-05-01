import { buildAuthModule } from '@lambder/auth/module';
import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestProductsApp } from './helpers/build-test-app';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

describe('products-api integration: CRUD with JWT auth', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: ReturnType<typeof buildTestProductsApp>;
  let auth: ReturnType<typeof buildAuthModule>;

  // Provision a user + tokens via the auth module directly (no need to wire
  // a second Hono app for the integration scope).
  async function provisionUser(email: string): Promise<{ userId: string; tokens: Tokens }> {
    const password = 'StrongPass1!@#';
    const signupRes = await auth.signup.execute({ email, password });
    if (!signupRes.ok) throw new Error('signup failed: ' + signupRes.error.message);
    const loginRes = await auth.login.execute({ email, password });
    if (!loginRes.ok) throw new Error('login failed: ' + loginRes.error.message);
    return { userId: signupRes.value.id, tokens: loginRes.value };
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

  test('list and get are public; mutations require auth', async () => {
    const list = await app.request('/products');
    expect(list.status).toBe(200);

    const create = await app.request('/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X', price: '1.00' }),
    });
    expect(create.status).toBe(401);
  });

  test('owner can create / update / delete; non-owner is forbidden', async () => {
    const owner = await provisionUser(`owner+${Date.now()}@example.com`);
    const stranger = await provisionUser(`stranger+${Date.now()}@example.com`);

    // create
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Widget', description: 'Hello', price: '9.99' }),
    });
    expect(created.status).toBe(201);
    const product = await created.json();
    expect(product.ownerId).toBe(owner.userId);

    // public get
    const fetched = await app.request(`/products/${product.id}`);
    expect(fetched.status).toBe(200);

    // stranger cannot patch
    const strangerPatch = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${stranger.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Hijack' }),
    });
    expect(strangerPatch.status).toBe(403);

    // owner can patch
    const ownerPatch = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${owner.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ price: '12.50' }),
    });
    expect(ownerPatch.status).toBe(200);
    const patched = await ownerPatch.json();
    expect(patched.price).toBe('12.50');

    // stranger cannot delete
    const strangerDelete = await app.request(`/products/${product.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${stranger.tokens.accessToken}` },
    });
    expect(strangerDelete.status).toBe(403);

    // owner can delete
    const ownerDelete = await app.request(`/products/${product.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${owner.tokens.accessToken}` },
    });
    expect(ownerDelete.status).toBe(204);

    const after = await app.request(`/products/${product.id}`);
    expect(after.status).toBe(404);
  });

  test('list paginates with cursor', async () => {
    const owner = await provisionUser(`pager+${Date.now()}@example.com`);
    for (let i = 0; i < 5; i++) {
      await app.request('/products', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${owner.tokens.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: `P${i}`, price: '1.00' }),
      });
    }

    const page1 = await (await app.request('/products?limit=2')).json();
    expect(page1.items.length).toBeGreaterThanOrEqual(2);
    expect(page1.nextCursor).toBeTypeOf('string');

    const page2 = await (await app.request(`/products?limit=2&cursor=${page1.nextCursor}`)).json();
    expect(Array.isArray(page2.items)).toBe(true);
  });
});
