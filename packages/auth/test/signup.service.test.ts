import { isErr, isOk } from '@lambder/shared-kernel';
import { describe, expect, test } from 'vitest';
import { SignupService } from '../src/application/services/signup.service';
import { createFakeHasher, createFakeUserRepository } from './fakes';

describe('SignupService', () => {
  test('creates a new user and returns public DTO', async () => {
    const repo = createFakeUserRepository();
    const svc = new SignupService(repo, createFakeHasher());
    const result = await svc.execute({ email: 'A@B.com', password: 'StrongPass1!' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.email).toBe('a@b.com');
      expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });

  test('rejects duplicate email (case-insensitive)', async () => {
    const repo = createFakeUserRepository();
    const svc = new SignupService(repo, createFakeHasher());
    await svc.execute({ email: 'a@b.com', password: 'StrongPass1!' });
    const result = await svc.execute({ email: 'A@B.com', password: 'AnotherPass2!' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('EMAIL_TAKEN');
  });

  test('persists the hasher output, not raw input', async () => {
    const repo = createFakeUserRepository();
    const svc = new SignupService(repo, createFakeHasher());
    await svc.execute({ email: 'x@y.com', password: 'StrongPass1!' });
    const stored = repo.users.get('x@y.com');
    // Fake hasher wraps the plain text — contract is that the service routes
    // through the hasher, not that the fake produces a secure digest.
    expect(stored?.passwordHash).toBe('hash(StrongPass1!)');
  });
});
