import type { AuthModule } from '@lambder/auth';
import { loginBody } from '@lambder/contracts';
import { isErr } from '@lambder/shared-kernel';
import { Hono } from 'hono';
import { mapError } from '../middleware/error-mapper';

export const loginRoute = (auth: AuthModule) => {
  const app = new Hono();
  app.post('/login', async (c) => {
    let body;
    try {
      body = loginBody.parse(await c.req.json());
    } catch (e) {
      return mapError(e, c);
    }
    const result = await auth.authService.login(body);
    if (isErr(result)) return mapError(result.error, c);
    return c.json(result.value, 200);
  });
  return app;
};
