import { getRedis } from '@lambder/cache';
import { getDb } from '@lambder/db';
import { LoginService } from './application/services/login.service.js';
import { LogoutService } from './application/services/logout.service.js';
import { RefreshService } from './application/services/refresh.service.js';
import { SignupService } from './application/services/signup.service.js';
import { Argon2Hasher } from './infrastructure/crypto/argon2.hasher.js';
import { JoseJwtService } from './infrastructure/crypto/jose-jwt.service.js';
import { RedisTokenStore } from './infrastructure/cache/redis-token.store.js';
import { UserDrizzleRepository } from './infrastructure/repositories/user.drizzle-repository.js';
import type { JwtService } from './domain/interfaces/jwt-service.js';

export interface AuthModuleConfig {
  databaseUrl: string;
  redisUrl: string;
  jwtPrivateKeyPem: string;
  jwtPublicKeyPem: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  issuer?: string;
  audience?: string;
}

export interface AuthModule {
  signup: SignupService;
  login: LoginService;
  logout: LogoutService;
  refresh: RefreshService;
  jwt: JwtService;
  tokens: RedisTokenStore;
}

export const buildAuthModule = (config: AuthModuleConfig): AuthModule => {
  const db = getDb(config.databaseUrl);
  const redis = getRedis(config.redisUrl);

  const users = new UserDrizzleRepository(db);
  const hasher = new Argon2Hasher();
  const tokens = new RedisTokenStore(redis);
  const jwt = new JoseJwtService({
    privateKeyPem: config.jwtPrivateKeyPem,
    publicKeyPem: config.jwtPublicKeyPem,
    ...(config.issuer ? { issuer: config.issuer } : {}),
    ...(config.audience ? { audience: config.audience } : {}),
  });

  return {
    signup: new SignupService(users, hasher),
    login: new LoginService(users, hasher, jwt, tokens, {
      accessTtlSeconds: config.accessTtlSeconds,
      refreshTtlSeconds: config.refreshTtlSeconds,
    }),
    logout: new LogoutService(tokens),
    refresh: new RefreshService(jwt, tokens, {
      accessTtlSeconds: config.accessTtlSeconds,
      refreshTtlSeconds: config.refreshTtlSeconds,
    }),
    jwt,
    tokens,
  };
};
