import { buildAuthModule, type AuthModule } from '@lambder/auth/module';
import { Hono } from 'hono';
import { loadConfig } from './config';
import { errorMapper } from './middleware/error-mapper';
import { loginRoute } from './routes/login.route';
import { logoutRoute } from './routes/logout.route';
import { refreshRoute } from './routes/refresh.route';
import { signupRoute } from './routes/signup.route';

export const buildAuthApp = (auth?: AuthModule) => {
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
  app.onError(errorMapper);
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/auth', signupRoute(module));
  app.route('/auth', loginRoute(module));
  app.route('/auth', logoutRoute(module));
  app.route('/auth', refreshRoute(module));
  return app;
};
