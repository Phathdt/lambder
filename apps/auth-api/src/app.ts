import { buildAuthModule, type AuthModule } from '@lambder/auth/module';
import { createLogger, type Logger } from '@lambder/shared-kernel';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config';
import { errorMapper } from './middleware/error-mapper';
import { requestLogger } from './middleware/request-logger';
import { loginRoute } from './routes/login.route';
import { logoutRoute } from './routes/logout.route';
import { refreshRoute } from './routes/refresh.route';
import { signupRoute } from './routes/signup.route';

export const buildAuthApp = (auth?: AuthModule, logger?: Logger) => {
  const log =
    logger ??
    createLogger({ service: 'auth-api', pretty: process.env.NODE_ENV !== 'production' });
  /* c8 ignore next 22 */
  const module =
    auth ??
    buildAuthModule(
      ((env) => ({
        databaseUrl: env.DATABASE_URL,
        redisUrl: env.REDIS_URL,
        jwtPrivateKeyPem: env.JWT_PRIVATE_KEY_PEM,
        jwtPublicKeyPem: env.JWT_PUBLIC_KEY_PEM,
        accessTtlSeconds: env.JWT_ACCESS_TTL,
        refreshTtlSeconds: env.JWT_REFRESH_TTL,
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        email: {
          queueUrl: env.EMAIL_QUEUE_URL,
          region: env.AWS_REGION,
          ...(env.AWS_ENDPOINT_URL ? { endpoint: env.AWS_ENDPOINT_URL } : {}),
        },
        logger: log,
      }))(loadConfig()),
    );

  const app = new Hono();
  // Browser FE talks to API Gateway — open CORS for local + configurable origins.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());
  app.use(
    '*',
    cors({
      origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]),
      credentials: true,
      allowHeaders: ['authorization', 'content-type'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use('*', requestLogger(log));
  app.onError(errorMapper);
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/auth', signupRoute(module));
  app.route('/auth', loginRoute(module));
  app.route('/auth', logoutRoute(module));
  app.route('/auth', refreshRoute(module));
  return app;
};
