import { createInMemoryEmailEnqueuer, type InMemoryEmailEnqueuer } from '@lambder/email/test-fakes';
import { isErr, isOk, type Logger } from '@lambder/shared-kernel';
import { beforeEach, describe, expect, test, vi } from 'vitest';
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

const stubLogger = (): Logger =>
  ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn(), trace: vi.fn(), fatal: vi.fn(), child: vi.fn() } as unknown as Logger);

const buildService = (overrides: { emailEnqueuer?: InMemoryEmailEnqueuer; logger?: Logger } = {}) => {
  const users = createFakeUserRepository();
  const hasher = createFakeHasher();
  const jwt = createFakeJwtService();
  const tokens = createFakeTokenStore();
  const emailEnqueuer = overrides.emailEnqueuer ?? createInMemoryEmailEnqueuer();
  const logger = overrides.logger;
  const service = new AuthService(
    users,
    hasher,
    jwt,
    tokens,
    emailEnqueuer,
    { accessTtlSeconds: 900, refreshTtlSeconds: 604_800 },
    logger,
  );
  return { service, users, jwt, tokens, emailEnqueuer, logger };
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

  test('enqueues a welcome email after successful signup', async () => {
    const { service, emailEnqueuer } = buildService();
    const result = await service.signup({ email: 'q@r.com', password: 'StrongPass1!' });
    expect(isOk(result)).toBe(true);
    expect(emailEnqueuer.calls).toHaveLength(1);
    expect(emailEnqueuer.calls[0]).toMatchObject({ email: 'q@r.com' });
    if (isOk(result)) expect(emailEnqueuer.calls[0]?.userId).toBe(result.value.id);
  });

  test('swallows enqueue failures and still returns ok (signup is critical, email is best-effort)', async () => {
    const emailEnqueuer = createInMemoryEmailEnqueuer();
    emailEnqueuer.failNext('SQS down');
    const logger = stubLogger();
    const { service } = buildService({ emailEnqueuer, logger });

    const result = await service.signup({ email: 'fail@x.com', password: 'StrongPass1!' });

    expect(isOk(result)).toBe(true);
    expect(emailEnqueuer.calls).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'welcome-email.enqueue-failed',
    );
  });

  test('does not enqueue when signup is rejected (duplicate email)', async () => {
    const { service, emailEnqueuer } = buildService();
    await service.signup({ email: 'dup@a.com', password: 'StrongPass1!' });
    emailEnqueuer.calls.length = 0;
    const result = await service.signup({ email: 'dup@a.com', password: 'StrongPass1!' });
    expect(isErr(result)).toBe(true);
    expect(emailEnqueuer.calls).toHaveLength(0);
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
