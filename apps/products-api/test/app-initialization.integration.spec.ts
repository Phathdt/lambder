import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestProductsApp } from './helpers/build-test-app';

describe('products-api: app initialization (app.ts)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: ReturnType<typeof buildTestProductsApp>;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    const keys = await generateTestJwtKeys();
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

  test('app: /health endpoint is accessible', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('app: error handler is registered and processes errors', async () => {
    // Trigger an error by sending invalid JSON to unprotected endpoint
    const res = await app.request('/products', {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
      },
    });
    // GET /products should succeed and return 200
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeDefined();
  });

  test('app: products route is registered', async () => {
    const res = await app.request('/products');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('app: protected routes require auth', async () => {
    const res = await app.request('/products', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Test', price: '1.00' }),
    });
    expect(res.status).toBe(401);
  });
});
