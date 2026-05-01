import { buildAuthModule } from '@lambder/auth/module';
import { createLogger } from '@lambder/shared-kernel';
import { buildAuthApp } from '../app';

// Silent logger keeps test output clean.
const silentLogger = createLogger({ service: 'auth-api-test', level: 'silent' });

export interface TestAppEnv {
  databaseUrl: string;
  redisUrl: string;
  jwtPrivateKeyPem: string;
  jwtPublicKeyPem: string;
  issuer?: string;
  audience?: string;
}

// Builds a Hono app wired against testcontainer-backed infra. Uses short
// TTLs so token-expiry behaviour is observable inside reasonable test runs.
export const buildTestAuthApp = (env: TestAppEnv) => {
  const auth = buildAuthModule({
    databaseUrl: env.databaseUrl,
    redisUrl: env.redisUrl,
    jwtPrivateKeyPem: env.jwtPrivateKeyPem,
    jwtPublicKeyPem: env.jwtPublicKeyPem,
    accessTtlSeconds: 60,
    refreshTtlSeconds: 600,
    issuer: env.issuer ?? 'lambder-test',
    audience: env.audience ?? 'lambder-test.api',
  });
  return buildAuthApp(auth, silentLogger);
};
