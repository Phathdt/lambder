import { JoseJwtService, RedisTokenStore } from '@lambder/auth';
import { getRedis } from '@lambder/cache';
import { buildProductsModule } from '@lambder/products/module';
import { Hono } from 'hono';
import { errorMapper } from '../../src/middleware/error-mapper';
import { productsRoute } from '../../src/routes/products.route';

export interface TestAppEnv {
  databaseUrl: string;
  redisUrl: string;
  jwtPrivateKeyPem: string;
  jwtPublicKeyPem: string;
}

// Mirrors src/app.ts but skips loadConfig() (which would read process.env).
// Kept minimal to match the original for compatibility with tests.
export const buildTestProductsApp = (env: TestAppEnv) => {
  const products = buildProductsModule({ databaseUrl: env.databaseUrl });
  const jwt = new JoseJwtService({
    privateKeyPem: env.jwtPrivateKeyPem,
    publicKeyPem: env.jwtPublicKeyPem,
    issuer: 'lambder-test',
    audience: 'lambder-test.api',
  });
  const tokens = new RedisTokenStore(getRedis(env.redisUrl));

  const app = new Hono();
  app.onError(errorMapper);
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/products', productsRoute({ products, jwt, tokens }));
  return app;
};
