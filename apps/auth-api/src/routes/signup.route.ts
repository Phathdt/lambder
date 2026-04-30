import type { AuthModule } from '@lambder/auth';
import { signupBody } from '@lambder/contracts';
import { isErr } from '@lambder/shared-kernel';
import { Hono } from 'hono';
import { mapError } from '../middleware/error-mapper.js';

export const signupRoute = (auth: AuthModule) => {
  const app = new Hono();
  app.post('/signup', async (c) => {
    let body;
    try {
      body = signupBody.parse(await c.req.json());
    } catch (e) {
      return mapError(e, c);
    }
    const result = await auth.signup.execute(body);
    if (isErr(result)) return mapError(result.error, c);
    return c.json({ user: result.value }, 201);
  });
  return app;
};
