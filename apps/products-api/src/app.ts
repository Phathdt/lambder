import { getRedis } from '@lambder/cache';
import { JoseJwtService, RedisTokenStore } from '@lambder/auth';
import { buildProductsModule } from '@lambder/products/module';
import { Hono } from 'hono';
import { loadConfig } from './config';
import { errorMapper } from './middleware/error-mapper';
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

  const app = new Hono();
  app.onError(errorMapper);
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/products', productsRoute({ products, jwt, tokens }));
  return app;
};
