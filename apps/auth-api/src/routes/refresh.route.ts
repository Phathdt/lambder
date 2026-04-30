import type { AuthModule } from '@lambder/auth';
import { refreshBody } from '@lambder/contracts';
import { isErr } from '@lambder/shared-kernel';
import { Hono } from 'hono';
import { mapError } from '../middleware/error-mapper';

export const refreshRoute = (auth: AuthModule) => {
  const app = new Hono();
  app.post('/refresh', async (c) => {
    let body;
    try {
      body = refreshBody.parse(await c.req.json());
    } catch (e) {
      return mapError(e, c);
    }
    const result = await auth.refresh.execute(body);
    if (isErr(result)) return mapError(result.error, c);
    return c.json(result.value, 200);
  });
  return app;
};
