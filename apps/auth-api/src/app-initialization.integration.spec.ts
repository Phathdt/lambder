import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestAuthApp } from './__test-helpers__/build-test-app';

describe('auth-api: app initialization (app.ts)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: ReturnType<typeof buildTestAuthApp>;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    const keys = await generateTestJwtKeys();
    app = buildTestAuthApp({
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
    // Trigger an error by sending invalid JSON
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{invalid json}',
    });
    // Should be 500 due to unhandled JSON parse error
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
  });

  test('app: signup route is registered', async () => {
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: `app-test+${Date.now()}@test.com`, password: 'ValidPass1!@#' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBeDefined();
  });

  test('app: login route is registered', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'WrongPass1!@#' }),
    });
    // Login fails for non-existent user, but route exists
    expect([200, 401]).toContain(res.status);
  });

  test('app: logout route requires authorization', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: {},
    });
    expect(res.status).toBe(401);
  });

  test('app: refresh route is registered', async () => {
    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: 'invalid' }),
    });
    // Refresh fails for invalid token, but route exists
    expect([200, 401]).toContain(res.status);
  });
});
