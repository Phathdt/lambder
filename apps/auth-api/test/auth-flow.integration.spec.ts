import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestAuthApp } from './helpers/build-test-app';

describe('auth-api integration: signup → login → logout → refresh', () => {
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

  test('happy path covers all four endpoints', async () => {
    const email = `user+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';

    // signup
    const signup = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signup.status).toBe(201);
    const signupBody = await signup.json();
    expect(signupBody.user.email).toBe(email);

    // login
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    const tokens = await login.json();
    expect(tokens.accessToken).toBeTypeOf('string');
    expect(tokens.refreshToken).toBeTypeOf('string');

    // refresh rotates pair
    const refreshed = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    expect(refreshed.status).toBe(200);
    const newPair = await refreshed.json();
    expect(newPair.accessToken).not.toBe(tokens.accessToken);
    expect(newPair.refreshToken).not.toBe(tokens.refreshToken);

    // logout the new access token
    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${newPair.accessToken}` },
    });
    expect(logout.status).toBe(204);

    // logout again with same access → 401 (revoked)
    const logoutAgain = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${newPair.accessToken}` },
    });
    expect(logoutAgain.status).toBe(401);
  });

  test('signup rejects duplicate email with 409', async () => {
    const email = `dup+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';
    const first = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(first.status).toBe(201);
    const second = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(second.status).toBe(409);
  });

  test('login rejects unknown email with 401', async () => {
    const r = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'x' }),
    });
    expect(r.status).toBe(401);
  });

  test('refresh-token reuse triggers full session revoke', async () => {
    const email = `reuse+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';
    await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { refreshToken, accessToken } = await login.json();

    // First refresh succeeds.
    const r1 = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    expect(r1.status).toBe(200);

    // Reuse the original refresh → 401 + reuse code.
    const r2 = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    expect(r2.status).toBe(401);
    const body = await r2.json();
    expect(body.error.code).toBe('TOKEN_REUSED');

    // Original access token is no longer valid (whole session revoked).
    const guarded = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(guarded.status).toBe(401);
  });
});
