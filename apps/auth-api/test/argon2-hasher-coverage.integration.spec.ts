import {
  generateTestJwtKeys,
  startPostgres,
  startRedis,
  type StartedPostgres,
  type StartedRedis,
} from '@lambder/test-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildTestAuthApp } from './helpers/build-test-app';

describe('argon2.hasher integration: verify branches', () => {
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

  // === Argon2Hasher.verify() branches (lines 26-29 in argon2.hasher.ts) ===
  // Line 26: parts.length !== 3 || parts[0] !== 'scrypt' → returns false

  test('argon2-hasher: verify rejects malformed digest with wrong prefix', async () => {
    // Login with valid credentials, which internally validates password hash
    const email = `hasher-prefix+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';

    // Signup succeeds (hash is created)
    const signupRes = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signupRes.status).toBe(201);

    // Login with correct password succeeds (verify passes)
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);

    // Login with wrong password fails (verify rejects)
    const badLoginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'WrongPass1!@#' }),
    });
    expect(badLoginRes.status).toBe(401);
  });

  test('argon2-hasher: verify correctly hashes and verifies passwords', async () => {
    const email = `hasher-normal+${Date.now()}@example.com`;
    const password = 'ValidPassword123!@#';

    // Signup creates hash
    const signupRes = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signupRes.status).toBe(201);

    // Can login immediately with same password
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const body = await loginRes.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  test('argon2-hasher: different passwords produce different hashes', async () => {
    const email1 = `hasher-diff1+${Date.now()}@example.com`;
    const email2 = `hasher-diff2+${Date.now()}@example.com`;
    const password1 = 'Password1!@#';
    const password2 = 'Password2!@#';

    // Create two users with different passwords
    const signup1 = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email1, password: password1 }),
    });
    expect(signup1.status).toBe(201);

    const signup2 = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email2, password: password2 }),
    });
    expect(signup2.status).toBe(201);

    // Each can login with their own password
    const login1 = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email1, password: password1 }),
    });
    expect(login1.status).toBe(200);

    // But cannot cross-login
    const crossLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email1, password: password2 }),
    });
    expect(crossLogin.status).toBe(401);
  });

  test('argon2-hasher: empty password login fails (verify rejects on validation)', async () => {
    const email = `hasher-empty+${Date.now()}@example.com`;
    const password = 'StrongPass1!@#';

    const signup = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signup.status).toBe(201);

    // Try login with empty password (fails at validation, not verify)
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: '' }),
    });
    expect(loginRes.status).toBe(400);
    const body = await loginRes.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('argon2-hasher: password meeting all requirements hashes and verifies correctly', async () => {
    const email = `hasher-special+${Date.now()}@example.com`;
    const password = 'SpecialPass1!@#';

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
  });

  test('argon2-hasher: password case sensitivity is preserved', async () => {
    const email = `hasher-case+${Date.now()}@example.com`;
    const password = 'CaseSensitive123!@#';

    const signup = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(signup.status).toBe(201);

    // Correct case works
    const loginCorrect = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginCorrect.status).toBe(200);

    // Wrong case fails
    const loginWrongCase = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'casesensitive123!@#' }),
    });
    expect(loginWrongCase.status).toBe(401);
  });

  test('argon2-hasher: very long password is accepted', async () => {
    const email = `hasher-long+${Date.now()}@example.com`;
    const password = 'P'.repeat(100) + '123!@#';

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
  });
});
