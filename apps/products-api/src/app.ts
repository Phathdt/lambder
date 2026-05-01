// Production wiring entry — Lambda handler imports buildProductsApp(). Tests
// use a separate inlined helper to inject mock infra, so this file is
// excluded from integration coverage in vitest.integration.config.ts.
import { getRedis } from '@lambder/cache';
import { JoseJwtService, RedisTokenStore } from '@lambder/auth';
import { buildProductsModule } from '@lambder/products/module';
import { createLogger } from '@lambder/shared-kernel';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config';
import { errorMapper } from './middleware/error-mapper';
import { requestLogger } from './middleware/request-logger';
import { productsRoute } from './routes/products.route';

export const buildProductsApp = () => {
  const env = loadConfig();
  const products = buildProductsModule({ databaseUrl: env.DATABASE_URL });
  const jwt = new JoseJwtService({
    privateKeyPem: env.JWT_PRIVATE_KEY_PEM,
    publicKeyPem: env.JWT_PUBLIC_KEY_PEM,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  const tokens = new RedisTokenStore(getRedis(env.REDIS_URL));
  const log = createLogger({
    service: 'products-api',
    pretty: process.env.NODE_ENV !== 'production',
  });

  const app = new Hono();
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
  app.use('*', requestLogger(log));
  app.onError(errorMapper);
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/products', productsRoute({ products, jwt, tokens }));
  return app;
};
