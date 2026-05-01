import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestAuthApp } from './helpers/build-test-app';

describe('auth-api: user.repository coverage', () => {
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

  test('user.repository: findByEmail returns null for non-existent email', async () => {
    // Login with non-existent email (exercises the null return path)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `nonexistent+${Date.now()}@example.com`,
        password: 'SomePass1!@#',
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('user.repository: findByEmailWithHash is case-insensitive on email', async () => {
    const email = `case-insensitive+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';

    // Signup with lowercase email
    const signupRes = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signupRes.status).toBe(201);

    // Login with uppercase email (tests case-insensitive lookup)
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.toUpperCase(), password }),
    });
    expect(loginRes.status).toBe(200);
    const tokens = await loginRes.json();
    expect(tokens.accessToken).toBeDefined();
  });

  test('user.repository: findById is exercised during refresh flow', async () => {
    const email = `findbyid+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';

    // Signup
    const signupRes = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signupRes.status).toBe(201);
    const signupData = await signupRes.json();
    expect(signupData.user.id).toBeDefined();

    // Login to get refresh token
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const { refreshToken } = await loginRes.json();

    // Refresh uses findById to retrieve the user
    const refreshRes = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    expect(refreshRes.status).toBe(200);
    const newTokens = await refreshRes.json();
    expect(newTokens.accessToken).toBeDefined();
  });
});
