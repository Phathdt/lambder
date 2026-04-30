import { config } from 'dotenv';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
config({ path: resolve(process.cwd(), '../../.env') });
config();
const { buildProductsApp } = await import('./app');

const port = Number.parseInt(process.env.PORT ?? '3002', 10);
serve({ fetch: buildProductsApp().fetch, port }, (info) => {
  console.log(`products-api listening on http://localhost:${info.port}`);
});
