import { buildAuthModule } from '@lambder/auth/module';
import { createInMemoryEmailEnqueuer, type InMemoryEmailEnqueuer } from '@lambder/email/test-fakes';
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

export interface TestAppHandle {
  app: ReturnType<typeof buildAuthApp>;
  emailEnqueuer: InMemoryEmailEnqueuer;
}

// Builds a Hono app wired against testcontainer-backed infra. Uses short
// TTLs so token-expiry behaviour is observable inside reasonable test runs.
// Returns the in-memory email enqueuer so tests can assert side-effects.
export const buildTestAuthApp = (env: TestAppEnv): TestAppHandle => {
  const emailEnqueuer = createInMemoryEmailEnqueuer();
  const auth = buildAuthModule({
    databaseUrl: env.databaseUrl,
    redisUrl: env.redisUrl,
    jwtPrivateKeyPem: env.jwtPrivateKeyPem,
    jwtPublicKeyPem: env.jwtPublicKeyPem,
    accessTtlSeconds: 60,
    refreshTtlSeconds: 600,
    issuer: env.issuer ?? 'lambder-test',
    audience: env.audience ?? 'lambder-test.api',
    emailEnqueuer,
  });
  return { app: buildAuthApp(auth, silentLogger), emailEnqueuer };
};
