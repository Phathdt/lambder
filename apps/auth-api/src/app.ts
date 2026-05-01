import { buildAuthModule, type AuthModule } from '@lambder/auth/module';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config';
import { errorMapper } from './middleware/error-mapper';
import { loginRoute } from './routes/login.route';
import { logoutRoute } from './routes/logout.route';
import { refreshRoute } from './routes/refresh.route';
import { signupRoute } from './routes/signup.route';

export const buildAuthApp = (auth?: AuthModule) => {
  /* c8 ignore next 14 */
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
      }))(loadConfig()),
    );

  const app = new Hono();
  // Browser FE talks to API Gateway — open CORS for local + configurable origins.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
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
  app.onError(errorMapper);
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/auth', signupRoute(module));
  app.route('/auth', loginRoute(module));
  app.route('/auth', logoutRoute(module));
  app.route('/auth', refreshRoute(module));
  return app;
};
