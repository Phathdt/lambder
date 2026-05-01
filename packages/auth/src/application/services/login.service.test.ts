import { isErr, isOk } from '@lambder/shared-kernel';
import { beforeEach, describe, expect, test } from 'vitest';
import { LoginService } from './login.service';
import { SignupService } from './signup.service';
import {
  createFakeHasher,
  createFakeJwtService,
  createFakeTokenStore,
  createFakeUserRepository,
  type FakeJwtService,
  type FakeTokenStore,
  type FakeUserRepository,
} from '../../__test-fakes__/fakes';

describe('LoginService', () => {
  let repo: FakeUserRepository;
  let tokens: FakeTokenStore;
  let jwt: FakeJwtService;
  let login: LoginService;

  beforeEach(async () => {
    repo = createFakeUserRepository();
    tokens = createFakeTokenStore();
    jwt = createFakeJwtService();
    const hasher = createFakeHasher();
    await new SignupService(repo, hasher).execute({
      email: 'a@b.com',
      password: 'StrongPass1!',
    });
    login = new LoginService(repo, hasher, jwt, tokens, {
      accessTtlSeconds: 900,
      refreshTtlSeconds: 604_800,
    });
  });

  test('issues access + refresh tokens on valid credentials', async () => {
    const result = await login.execute({ email: 'a@b.com', password: 'StrongPass1!' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.accessToken).toBeTypeOf('string');
      expect(result.value.refreshToken).toBeTypeOf('string');
      expect(result.value.expiresIn).toBe(900);
    }
    expect(jwt.issued).toHaveLength(2);
    expect(jwt.issued[0]?.token).toBe('tok-1');
  });

  test('whitelists both tokens in the token store', async () => {
    const result = await login.execute({ email: 'a@b.com', password: 'StrongPass1!' });
    expect(isOk(result)).toBe(true);
    const userId = [...repo.users.values()][0]!.id;
    expect(tokens.whitelisted.get(userId)?.size).toBe(2);
  });

  test('rejects unknown email with INVALID_CREDENTIALS (no enumeration)', async () => {
    const result = await login.execute({ email: 'nope@b.com', password: 'whatever' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects wrong password with same INVALID_CREDENTIALS code', async () => {
    const result = await login.execute({ email: 'a@b.com', password: 'WrongPass1!' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('INVALID_CREDENTIALS');
  });
});
