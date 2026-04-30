import { isErr, isOk } from '@lambder/shared-kernel';
import { beforeEach, describe, expect, test } from 'vitest';
import { LoginService } from '../src/application/services/login.service';
import { RefreshService } from '../src/application/services/refresh.service';
import { SignupService } from '../src/application/services/signup.service';
import {
  createFakeHasher,
  createFakeJwtService,
  createFakeTokenStore,
  createFakeUserRepository,
  type FakeJwtService,
  type FakeTokenStore,
} from './fakes';

describe('RefreshService', () => {
  let tokens: FakeTokenStore;
  let jwt: FakeJwtService;
  let refresh: RefreshService;
  let initialRefreshToken: string;
  let initialAccessToken: string;
  let userId: string;

  beforeEach(async () => {
    tokens = createFakeTokenStore();
    jwt = createFakeJwtService();
    const repo = createFakeUserRepository();
    const hasher = createFakeHasher();
    await new SignupService(repo, hasher).execute({
      email: 'a@b.com',
      password: 'StrongPass1!',
    });
    const login = new LoginService(repo, hasher, jwt, tokens, {
      accessTtlSeconds: 900,
      refreshTtlSeconds: 604_800,
    });
    const result = await login.execute({ email: 'a@b.com', password: 'StrongPass1!' });
    if (!isOk(result)) throw new Error('login failed');
    initialAccessToken = result.value.accessToken;
    initialRefreshToken = result.value.refreshToken;
    userId = [...repo.users.values()][0]!.id;
    refresh = new RefreshService(jwt, tokens, {
      accessTtlSeconds: 900,
      refreshTtlSeconds: 604_800,
    });
  });

  test('rotates: issues new pair, revokes the presented refresh', async () => {
    const result = await refresh.execute({ refreshToken: initialRefreshToken });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.accessToken).not.toBe(initialAccessToken);
      expect(result.value.refreshToken).not.toBe(initialRefreshToken);
    }
    // Old refresh jti should no longer be whitelisted.
    const oldRefreshJti = jwt.issued[1]!.jti;
    expect(await tokens.isWhitelisted(userId, oldRefreshJti)).toBe(false);
  });

  test('rejects an access token presented as refresh', async () => {
    const result = await refresh.execute({ refreshToken: initialAccessToken });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('INVALID_TOKEN');
  });

  test('rejects unknown token signatures', async () => {
    const result = await refresh.execute({ refreshToken: 'garbage' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('INVALID_TOKEN');
  });

  test('detects refresh-token reuse and revokes all sessions', async () => {
    // First use → success, old jti revoked.
    const first = await refresh.execute({ refreshToken: initialRefreshToken });
    expect(isOk(first)).toBe(true);

    // Reuse the same refresh → should detect and revokeAll.
    const reuse = await refresh.execute({ refreshToken: initialRefreshToken });
    expect(isErr(reuse)).toBe(true);
    if (isErr(reuse)) expect(reuse.error.code).toBe('TOKEN_REUSED');
    expect(tokens.revokeAllCalls).toContain(userId);
    expect(tokens.whitelisted.has(userId)).toBe(false);
  });
});
