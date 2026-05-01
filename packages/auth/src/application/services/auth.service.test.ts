import { isErr, isOk } from '@lambder/shared-kernel';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  createFakeHasher,
  createFakeJwtService,
  createFakeTokenStore,
  createFakeUserRepository,
  type FakeJwtService,
  type FakeTokenStore,
  type FakeUserRepository,
} from '../../__test-fakes__/fakes';
import { AuthService } from './auth.service';

const buildService = () => {
  const users = createFakeUserRepository();
  const hasher = createFakeHasher();
  const jwt = createFakeJwtService();
  const tokens = createFakeTokenStore();
  const service = new AuthService(users, hasher, jwt, tokens, {
    accessTtlSeconds: 900,
    refreshTtlSeconds: 604_800,
  });
  return { service, users, jwt, tokens };
};

describe('AuthService.signup', () => {
  test('creates a new user and returns public DTO', async () => {
    const { service } = buildService();
    const result = await service.signup({ email: 'A@B.com', password: 'StrongPass1!' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.email).toBe('a@b.com');
      expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });

  test('rejects duplicate email (case-insensitive)', async () => {
    const { service } = buildService();
    await service.signup({ email: 'a@b.com', password: 'StrongPass1!' });
    const result = await service.signup({ email: 'A@B.com', password: 'AnotherPass2!' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('EMAIL_TAKEN');
  });

  test('routes the password through the hasher', async () => {
    const { service, users } = buildService();
    await service.signup({ email: 'x@y.com', password: 'StrongPass1!' });
    expect(users.users.get('x@y.com')?.passwordHash).toBe('hash(StrongPass1!)');
  });
});

describe('AuthService.login', () => {
  let env: ReturnType<typeof buildService>;

  beforeEach(async () => {
    env = buildService();
    await env.service.signup({ email: 'a@b.com', password: 'StrongPass1!' });
  });

  test('issues access + refresh tokens on valid credentials', async () => {
    const result = await env.service.login({ email: 'a@b.com', password: 'StrongPass1!' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.accessToken).toBeTypeOf('string');
      expect(result.value.refreshToken).toBeTypeOf('string');
      expect(result.value.expiresIn).toBe(900);
    }
    expect(env.jwt.issued).toHaveLength(2);
  });

  test('whitelists both jtis in the token store', async () => {
    await env.service.login({ email: 'a@b.com', password: 'StrongPass1!' });
    const userId = [...env.users.users.values()][0]!.id;
    expect(env.tokens.whitelisted.get(userId)?.size).toBe(2);
  });

  test('returns INVALID_CREDENTIALS for unknown email (no enumeration)', async () => {
    const result = await env.service.login({ email: 'nope@b.com', password: 'whatever' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('returns INVALID_CREDENTIALS for wrong password', async () => {
    const result = await env.service.login({ email: 'a@b.com', password: 'WrongPass1!' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('AuthService.logout', () => {
  test('revokes a specific (userId, jti) pair', async () => {
    const { service, tokens } = buildService();
    await tokens.whitelist('u1', 'jti-1', 60);
    await tokens.whitelist('u1', 'jti-2', 60);
    await service.logout({ userId: 'u1', jti: 'jti-1' });
    expect(await tokens.isWhitelisted('u1', 'jti-1')).toBe(false);
    expect(await tokens.isWhitelisted('u1', 'jti-2')).toBe(true);
  });

  test('is idempotent on missing entries', async () => {
    const { service } = buildService();
    await expect(service.logout({ userId: 'u1', jti: 'missing' })).resolves.toBeUndefined();
  });
});

describe('AuthService.refresh', () => {
  let env: ReturnType<typeof buildService>;
  let initialAccessToken: string;
  let initialRefreshToken: string;
  let userId: string;

  beforeEach(async () => {
    env = buildService();
    await env.service.signup({ email: 'a@b.com', password: 'StrongPass1!' });
    const login = await env.service.login({ email: 'a@b.com', password: 'StrongPass1!' });
    if (!isOk(login)) throw new Error('login failed');
    initialAccessToken = login.value.accessToken;
    initialRefreshToken = login.value.refreshToken;
    userId = [...env.users.users.values()][0]!.id;
  });

  test('rotates: issues new pair, revokes the presented refresh', async () => {
    const result = await env.service.refresh({ refreshToken: initialRefreshToken });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.accessToken).not.toBe(initialAccessToken);
      expect(result.value.refreshToken).not.toBe(initialRefreshToken);
    }
    const oldRefreshJti = env.jwt.issued[1]!.jti;
    expect(await env.tokens.isWhitelisted(userId, oldRefreshJti)).toBe(false);
  });

  test('rejects an access token presented as refresh', async () => {
    const result = await env.service.refresh({ refreshToken: initialAccessToken });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('INVALID_TOKEN');
  });

  test('rejects unknown token signatures', async () => {
    const result = await env.service.refresh({ refreshToken: 'garbage' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('INVALID_TOKEN');
  });

  test('detects refresh-token reuse and revokes all sessions', async () => {
    const first = await env.service.refresh({ refreshToken: initialRefreshToken });
    expect(isOk(first)).toBe(true);

    const reuse = await env.service.refresh({ refreshToken: initialRefreshToken });
    expect(isErr(reuse)).toBe(true);
    if (isErr(reuse)) expect(reuse.error.code).toBe('TOKEN_REUSED');
    expect(env.tokens.revokeAllCalls).toContain(userId);
    expect(env.tokens.whitelisted.has(userId)).toBe(false);
  });
});
