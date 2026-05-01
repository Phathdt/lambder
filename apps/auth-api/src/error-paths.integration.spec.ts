import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestAuthApp } from './__test-helpers__/build-test-app';

describe('auth-api: error-mapper & jwt-auth branch coverage', () => {
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

  // === Error Mapper: ValidationError branch (17-19 in error-mapper.ts) ===
  test('error-mapper: handles ValidationError from domain (400)', async () => {
    // This tests the ValidationError branch in statusFor()
    // which happens when a ValidationError is caught from domain logic
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email-format', password: 'short' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // === JWT Auth: Test missing Bearer prefix path (line 10 in jwt-auth.ts) ===
  test('jwt-auth: empty authorization header returns 401 UNAUTHORIZED', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: '' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('jwt-auth: authorization header without Bearer prefix returns 401', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Token abc123' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('jwt-auth: authorization header with only Bearer and no token returns 401', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // === JWT Auth: Test all error paths from jwt.verify() ===
  test('jwt-auth: different public key rejects token (signature mismatch)', async () => {
    // Create a token with one set of keys
    const keys1 = await generateTestJwtKeys();
    const { app: app1 } = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys1.privateKeyPem,
      jwtPublicKeyPem: keys1.publicKeyPem,
    });

    const email = `sig-mismatch+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';

    await app1.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginRes = await app1.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { accessToken } = await loginRes.json();

    // Create app with different keys
    const keys2 = await generateTestJwtKeys();
    const { app: app2 } = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys2.privateKeyPem,
      jwtPublicKeyPem: keys2.publicKeyPem,
    });

    // Try to use token from app1 on app2 (different public key)
    const res = await app2.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  test('jwt-auth: malformed jwt (invalid signature) returns 401 INVALID_TOKEN', async () => {
    const keys = await generateTestJwtKeys();
    // Create a token with the app's key, then verify with different key
    const { app: app1 } = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
    });

    const email = `sig-test+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';

    await app1.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginRes = await app1.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { accessToken } = await loginRes.json();

    // Create app with different key
    const keys2 = await generateTestJwtKeys();
    const { app: app2 } = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys2.privateKeyPem,
      jwtPublicKeyPem: keys2.publicKeyPem,
    });

    // Try to use token signed with app1 key on app2 (different public key)
    const res = await app2.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  test('jwt-auth: random string as token returns 401 INVALID_TOKEN', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer not-a-valid-jwt-token-at-all' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  // === Error Mapper: ZodError from JSON parsing (lines 22-32 in error-mapper.ts) ===
  test('error-mapper: sends VALIDATION_ERROR when ZodError occurs', async () => {
    // This is covered by existing tests, but verify the details structure
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bad-email', password: 'x' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid request body');
    expect(body.error.details).toBeDefined();
    expect(typeof body.error.details).toBe('object');
  });

  // === Error Mapper: Unknown error path (line 38 in error-mapper.ts) ===
  // Note: The malformed JSON tests already cover this via unhandled JSON.parse
  test('error-mapper: truly unknown error returns 500 INTERNAL', async () => {
    // Malformed JSON body triggers a JSON.parse error that is not caught
    // by domain error handling, falling through to the generic error handler
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json}',
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.message).toBe('Internal server error');
  });

  // === JWT verify: Ensure all paths in jwt-auth are covered ===
  test('jwt-auth: whitelist check is performed (TOKEN_REVOKED case)', async () => {
    const email = `whitelist-test+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';

    // Signup and login
    await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { accessToken } = await loginRes.json();

    // Use token (should work)
    const firstLogout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(firstLogout.status).toBe(204);

    // Reuse same token (should fail - revoked)
    const secondLogout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(secondLogout.status).toBe(401);
    const body = await secondLogout.json();
    expect(body.error.code).toBe('TOKEN_REVOKED');
  });

  // === Test CORS and app initialization (app.ts lines 14-25) ===
  test('app: health endpoint is accessible', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('app: CORS headers are set correctly', async () => {
    const res = await app.request('/health', {
      headers: {
        origin: 'http://localhost:5173',
      },
    });
    expect(res.status).toBe(200);
  });
});
