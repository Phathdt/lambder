import { buildAuthModule } from '@lambder/auth/module';
import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestProductsApp } from './__test-helpers__/build-test-app';

describe('product.drizzle-repository integration: coverage for edge cases', () => {
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

  test('findById with non-existent id returns null', async () => {
    const user = await provisionUser(`repo-findbyid+${Date.now()}@example.com`);
    // Create a product then verify non-existent returns null
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Test', price: '1.00' }),
    });
    expect(created.status).toBe(201);

    // Now check repository directly by testing GET with fake ID
    const res = await app.request('/products/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  test('update product with only name field preserves others', async () => {
    const user = await provisionUser(`repo-update+${Date.now()}@example.com`);
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Original',
        description: 'Keep this',
        price: '5.00',
      }),
    });
    const product = await created.json();

    const updated = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'NameOnly' }),
    });
    expect(updated.status).toBe(200);
    const patched = await updated.json();
    expect(patched.name).toBe('NameOnly');
    expect(patched.description).toBe('Keep this');
    expect(patched.price).toBe('5.00');
  });

  test('update with all fields undefined (noop)', async () => {
    const user = await provisionUser(`repo-noop+${Date.now()}@example.com`);
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Original',
        description: 'Original desc',
        price: '5.00',
      }),
    });
    const product = await created.json();

    const updated = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(updated.status).toBe(200);
    const patched = await updated.json();
    expect(patched.name).toBe('Original');
    expect(patched.description).toBe('Original desc');
    expect(patched.price).toBe('5.00');
  });

  test('delete removes product from database', async () => {
    const user = await provisionUser(`repo-delete+${Date.now()}@example.com`);
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'ToDelete', price: '1.00' }),
    });
    const product = await created.json();

    const deleted = await app.request(`/products/${product.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${user.token}` },
    });
    expect(deleted.status).toBe(204);

    // Verify it's gone
    const fetched = await app.request(`/products/${product.id}`);
    expect(fetched.status).toBe(404);
  });

  test('list with cursor pagination', async () => {
    const user = await provisionUser(`repo-paginate+${Date.now()}@example.com`);

    // Create 5 products
    for (let i = 0; i < 5; i++) {
      await app.request('/products', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${user.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: `Product${i}`, price: `${i + 1}.00` }),
      });
    }

    // List with limit=2
    const page1Res = await app.request('/products?limit=2');
    expect(page1Res.status).toBe(200);
    const page1 = await page1Res.json();
    expect(page1.items.length).toBeGreaterThanOrEqual(1);

    if (page1.nextCursor) {
      const page2Res = await app.request(`/products?limit=2&cursor=${page1.nextCursor}`);
      expect(page2Res.status).toBe(200);
      const page2 = await page2Res.json();
      expect(Array.isArray(page2.items)).toBe(true);
    }
  });

  test('create product without description sets to null', async () => {
    const user = await provisionUser(`repo-nodesc+${Date.now()}@example.com`);
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'NoDesc', price: '1.00' }),
    });
    expect(created.status).toBe(201);
    const product = await created.json();
    expect(product.description).toBeNull();
  });

  test('patch with only price field updates price', async () => {
    const user = await provisionUser(`repo-price-patch+${Date.now()}@example.com`);
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Original',
        description: 'Keep',
        price: '5.00',
      }),
    });
    const product = await created.json();

    const updated = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ price: '10.00' }),
    });
    expect(updated.status).toBe(200);
    const patched = await updated.json();
    expect(patched.price).toBe('10.00');
    expect(patched.name).toBe('Original');
    expect(patched.description).toBe('Keep');
  });

  test('update with only description field', async () => {
    const user = await provisionUser(`repo-desc-patch+${Date.now()}@example.com`);
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Product',
        description: 'Old',
        price: '5.00',
      }),
    });
    const product = await created.json();

    const updated = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ description: 'New' }),
    });
    expect(updated.status).toBe(200);
    const patched = await updated.json();
    expect(patched.description).toBe('New');
    expect(patched.name).toBe('Product');
  });

  test('update with both name and description fields', async () => {
    const user = await provisionUser(`repo-both-patch+${Date.now()}@example.com`);
    const created = await app.request('/products', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Original',
        description: 'Original desc',
        price: '5.00',
      }),
    });
    const product = await created.json();

    const updated = await app.request(`/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated', description: 'Updated desc' }),
    });
    expect(updated.status).toBe(200);
    const patched = await updated.json();
    expect(patched.name).toBe('Updated');
    expect(patched.description).toBe('Updated desc');
    expect(patched.price).toBe('5.00');
  });

  test('list products returns paginated results with items', async () => {
    const user = await provisionUser(`repo-list+${Date.now()}@example.com`);

    // Create at least 3 products for pagination test
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/products', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${user.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: `List${i}`, price: `${i + 1}.00` }),
      });
      const prod = await res.json();
      ids.push(prod.id);
    }

    // List with small limit
    const listRes = await app.request('/products?limit=1');
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(Array.isArray(listData.items)).toBe(true);
    expect(listData.items.length).toBeGreaterThan(0);
  });
});
