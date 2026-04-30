import 'dotenv/config';
import { serve } from '@hono/node-server';
import { buildProductsApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3002', 10);
serve({ fetch: buildProductsApp().fetch, port }, (info) => {
  console.log(`products-api listening on http://localhost:${info.port}`);
});
