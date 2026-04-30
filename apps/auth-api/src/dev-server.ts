import 'dotenv/config';
import { serve } from '@hono/node-server';
import { buildAuthApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
serve({ fetch: buildAuthApp().fetch, port }, (info) => {
  console.log(`auth-api listening on http://localhost:${info.port}`);
});
