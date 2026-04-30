import { randomUUID } from 'node:crypto';
import type { NewUser, User, UserWithHash } from '../src/domain/entities/user.entity';
import type { Hasher } from '../src/domain/interfaces/hasher';
import type { JwtClaims, JwtKind, JwtService, SignedToken } from '../src/domain/interfaces/jwt-service';
import type { TokenStore } from '../src/domain/interfaces/token-store';
import type { UserRepository } from '../src/domain/interfaces/user.repository';

// Pure in-memory fakes for unit testing without DB/Redis/Argon2.

export const createFakeHasher = (): Hasher => ({
  async hash(plain) {
    return `hash(${plain})`;
  },
  async verify(plain, digest) {
    return digest === `hash(${plain})`;
  },
});

export interface FakeUserRepository extends UserRepository {
  readonly users: Map<string, UserWithHash>;
}

export const createFakeUserRepository = (): FakeUserRepository => {
  const users = new Map<string, UserWithHash>();
  return {
    users,
    async findByEmail(email) {
      const u = users.get(email.toLowerCase());
      if (!u) return null;
      const { passwordHash: _ph, ...rest } = u;
      void _ph;
      return rest;
    },
    async findByEmailWithHash(email) {
      return users.get(email.toLowerCase()) ?? null;
    },
    async findById(id) {
      for (const u of users.values()) {
        if (u.id === id) {
          const { passwordHash: _ph, ...rest } = u;
          void _ph;
          return rest;
        }
      }
      return null;
    },
    async create(input: NewUser): Promise<User> {
      const u: UserWithHash = {
        id: randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.set(input.email.toLowerCase(), u);
      const { passwordHash: _ph, ...rest } = u;
      void _ph;
      return rest;
    },
  };
};

export interface FakeTokenStore extends TokenStore {
  readonly whitelisted: Map<string, Set<string>>;
  readonly revokeAllCalls: string[];
}

export const createFakeTokenStore = (): FakeTokenStore => {
  const whitelisted = new Map<string, Set<string>>();
  const revokeAllCalls: string[] = [];
  return {
    whitelisted,
    revokeAllCalls,
    async whitelist(userId, jti) {
      if (!whitelisted.has(userId)) whitelisted.set(userId, new Set());
      whitelisted.get(userId)!.add(jti);
    },
    async isWhitelisted(userId, jti) {
      return whitelisted.get(userId)?.has(jti) ?? false;
    },
    async revoke(userId, jti) {
      whitelisted.get(userId)?.delete(jti);
    },
    async revokeAll(userId) {
      whitelisted.delete(userId);
      revokeAllCalls.push(userId);
    },
  };
};

export interface FakeJwtService extends JwtService {
  readonly issued: SignedToken[];
}

export const createFakeJwtService = (): FakeJwtService => {
  const issued: SignedToken[] = [];
  const tokenToClaims = new Map<string, JwtClaims>();
  let counter = 0;
  return {
    issued,
    async sign({ sub, kind, ttlSeconds }) {
      counter++;
      const jti = `jti-${counter}`;
      const token = `tok-${counter}`;
      const iat = Math.floor(Date.now() / 1000);
      const claims: JwtClaims = {
        sub,
        jti,
        kind: kind as JwtKind,
        iat,
        exp: iat + ttlSeconds,
      };
      tokenToClaims.set(token, claims);
      const signed: SignedToken = { token, jti, expiresAt: claims.exp };
      issued.push(signed);
      return signed;
    },
    async verify(token) {
      const claims = tokenToClaims.get(token);
      if (!claims) throw new Error('invalid token');
      return claims;
    },
  };
};
