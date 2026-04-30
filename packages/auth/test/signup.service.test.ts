import { isErr, isOk } from '@lambder/shared-kernel';
import { describe, expect, test } from 'vitest';
import { SignupService } from '../src/application/services/signup.service.js';
import type { Hasher } from '../src/domain/interfaces/hasher.js';
import type { UserRepository } from '../src/domain/interfaces/user.repository.js';

const fakeHasher: Hasher = {
  async hash(p) {
    return `hash(${p})`;
  },
  async verify(p, h) {
    return h === `hash(${p})`;
  },
};

const makeFakeRepo = (): UserRepository & { _users: Map<string, any> } => {
  const _users = new Map<string, any>();
  return {
    _users,
    async findByEmail(email) {
      return _users.get(email.toLowerCase()) ?? null;
    },
    async findByEmailWithHash(email) {
      return _users.get(email.toLowerCase()) ?? null;
    },
    async findById(id) {
      for (const u of _users.values()) if (u.id === id) return u;
      return null;
    },
    async create(input) {
      const u = {
        id: crypto.randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      _users.set(input.email.toLowerCase(), u);
      return u;
    },
  };
};

describe('SignupService', () => {
  test('creates a new user', async () => {
    const repo = makeFakeRepo();
    const svc = new SignupService(repo, fakeHasher);
    const result = await svc.execute({ email: 'A@B.com', password: 'StrongPass1!' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.email).toBe('a@b.com');
  });

  test('rejects duplicate email (case-insensitive)', async () => {
    const repo = makeFakeRepo();
    const svc = new SignupService(repo, fakeHasher);
    await svc.execute({ email: 'a@b.com', password: 'x' });
    const result = await svc.execute({ email: 'A@B.com', password: 'y' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('EMAIL_TAKEN');
  });
});
