import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestAuthApp } from './__test-helpers__/build-test-app';

describe('auth-api integration: signup → login → logout → refresh', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: ReturnType<typeof buildTestAuthApp>['app'];

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    const keys = await generateTestJwtKeys();
    ({ app } = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
    }));
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

  // === Error Mapper Tests ===
  test('error-mapper: zod validation errors return 400 with field errors', async () => {
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email', password: 'short' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  test('error-mapper: malformed JSON body returns 500 (unhandled JSON.parse error)', async () => {
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json {',
    });
    expect(res.status).toBe(500);
  });

  test('error-mapper: login with missing email field returns 400', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'test' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('error-mapper: refresh with malformed body returns 400', async () => {
    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 123 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // === JWT Auth Middleware Tests ===
  test('jwt-auth: missing authorization header returns 401', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('jwt-auth: malformed authorization header (not Bearer) returns 401', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Basic token123' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('jwt-auth: invalid token returns 401 with INVALID_TOKEN code', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  test('jwt-auth: refresh token used as access token returns 401', async () => {
    const email = `refresh-as-access+${Date.now()}@example.com`;
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
    const { refreshToken } = await login.json();

    // Try to use refresh token on endpoint requiring access
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  test('jwt-auth: revoked token returns 401 with TOKEN_REVOKED code', async () => {
    const email = `revoke+${Date.now()}@example.com`;
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
    const { accessToken } = await login.json();

    // Logout to revoke token
    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logoutRes.status).toBe(204);

    // Try to use revoked token
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TOKEN_REVOKED');
  });

  test('jwt-auth: bearer token without value returns 401', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer ' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // === Additional coverage for error-mapper generic error handling ===
  test('error-mapper: generic unhandled error returns 500 INTERNAL code', async () => {
    // This is implicitly tested via malformed JSON which throws outside try-catch
    // but we verify the error code structure
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'bad json',
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
  });

  test('error-mapper: multiple signup failures verify all error codes', async () => {
    // Test ConflictError (409)
    const email = `dup+${Date.now()}@example.com`;
    await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'StrongPass1!@#' }),
    });
    const dupRes = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'StrongPass1!@#' }),
    });
    expect(dupRes.status).toBe(409);
    expect((await dupRes.json()).error.code).toBe('EMAIL_TAKEN');

    // Test ValidationError (400) via bad email format
    const badRes = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'pass' }),
    });
    expect(badRes.status).toBe(400);
    expect((await badRes.json()).error.code).toBe('VALIDATION_ERROR');

    // Test AuthError (401) via login
    const badLoginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'nope' }),
    });
    expect(badLoginRes.status).toBe(401);
    expect((await badLoginRes.json()).error.code).toBe('INVALID_CREDENTIALS');
  });
});
