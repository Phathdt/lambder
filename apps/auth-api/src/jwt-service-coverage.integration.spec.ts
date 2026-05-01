import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestAuthApp } from './__test-helpers__/build-test-app';

describe('jose-jwt.service integration: issuer/audience verification', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
  });

  afterAll(async () => {
    await pg?.stop();
    await redis?.stop();
  });

  test('token signed with issuer cannot be verified with different issuer', async () => {
    const keys = await generateTestJwtKeys();

    // Sign with one issuer
    const app1 = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      issuer: 'issuer-a',
      audience: 'audience-a',
    });

    const email1 = `issuer-test1+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';
    const signup = await app1.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email1, password }),
    });
    const loginRes = await app1.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email1, password }),
    });
    const { accessToken } = await loginRes.json();

    // App with different issuer cannot verify the token
    const app2 = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      issuer: 'issuer-b',
      audience: 'audience-a',
    });

    const logoutRes = await app2.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logoutRes.status).toBe(401);
  });

  test('token signed with audience cannot be verified with different audience', async () => {
    const keys = await generateTestJwtKeys();

    const app1 = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      issuer: 'shared-issuer',
      audience: 'audience-x',
    });

    const email2 = `audience-test+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';
    await app1.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email2, password }),
    });
    const loginRes = await app1.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email2, password }),
    });
    const { accessToken } = await loginRes.json();

    // App with different audience cannot verify
    const app2 = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      issuer: 'shared-issuer',
      audience: 'audience-y',
    });

    const logoutRes = await app2.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logoutRes.status).toBe(401);
  });

  test('sign without issuer/audience config works', async () => {
    const keys = await generateTestJwtKeys();

    const app = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      issuer: undefined,
      audience: undefined,
    });

    const email3 = `no-config+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';
    const signup = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email3, password }),
    });
    expect(signup.status).toBe(201);

    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email3, password }),
    });
    expect(loginRes.status).toBe(200);
    const { accessToken } = await loginRes.json();

    // Can use token to logout
    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logoutRes.status).toBe(204);
  });

  test('verify rejects malformed tokens', async () => {
    const keys = await generateTestJwtKeys();
    const app = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
    });

    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer eyJhbGciOiJub25lIn0.invalid.token' },
    });
    expect(logoutRes.status).toBe(401);
  });

  test('can sign and verify token without issuer configured', async () => {
    const keys = await generateTestJwtKeys();

    // Signup and login with app that has NO issuer
    const app = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      issuer: undefined,
    });

    const email = `no-issuer+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';
    const signup = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signup.status).toBe(201);

    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    const { accessToken } = await login.json();

    // Token works for protected endpoint
    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logout.status).toBe(204);
  });

  test('can sign and verify token without audience configured', async () => {
    const keys = await generateTestJwtKeys();

    const app = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      audience: undefined,
    });

    const email = `no-audience+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';
    const signup = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signup.status).toBe(201);

    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    const { accessToken } = await login.json();

    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logout.status).toBe(204);
  });

  test('can sign and verify token with both issuer and audience configured', async () => {
    const keys = await generateTestJwtKeys();

    const app = buildTestAuthApp({
      databaseUrl: pg.url,
      redisUrl: redis.url,
      jwtPrivateKeyPem: keys.privateKeyPem,
      jwtPublicKeyPem: keys.publicKeyPem,
      issuer: 'test-issuer',
      audience: 'test-audience',
    });

    const email = `both-config+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';
    const signup = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signup.status).toBe(201);

    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    const { accessToken, refreshToken } = await login.json();

    // Test access token
    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logout.status).toBe(204);

    // Test refresh token
    const email2 = `both-config2+${Date.now()}@example.com`;
    await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email2, password }),
    });
    const login2 = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email2, password }),
    });
    const { refreshToken: rt } = await login2.json();

    const refreshed = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    expect(refreshed.status).toBe(200);
  });
});
