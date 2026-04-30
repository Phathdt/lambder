import { config } from 'dotenv';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
config({ path: resolve(process.cwd(), '../../.env') });
config(); // also load app-local .env if present
const { buildAuthApp } = await import('./app');

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
serve({ fetch: buildAuthApp().fetch, port }, (info) => {
  console.log(`auth-api listening on http://localhost:${info.port}`);
});
