import { getRedis } from '@lambder/cache';
import { getDb } from '@lambder/db';
import { AuthService } from './application/services/auth.service';
import type { JwtService } from './domain/interfaces/jwt-service';
import type { TokenStore } from './domain/interfaces/token-store';
import { Argon2Hasher } from './infrastructure/crypto/argon2.hasher';
import { JoseJwtService } from './infrastructure/crypto/jose-jwt.service';
import { RedisTokenStore } from './infrastructure/cache/redis-token.store';
import { UserDrizzleRepository } from './infrastructure/repositories/user.drizzle-repository';

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
  authService: AuthService;
  jwt: JwtService;
  tokens: TokenStore;
}

export const buildAuthModule = (config: AuthModuleConfig): AuthModule => {
  /* c8 ignore next 14 */
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

  const authService = new AuthService(users, hasher, jwt, tokens, {
    accessTtlSeconds: config.accessTtlSeconds,
    refreshTtlSeconds: config.refreshTtlSeconds,
  });

  return { authService, jwt, tokens };
};
