import type { AuthModule } from '@lambder/auth';
import { Hono } from 'hono';
import { jwtAuth } from '../middleware/jwt-auth';

export const logoutRoute = (auth: AuthModule) => {
  const app = new Hono();
  app.post('/logout', jwtAuth({ jwt: auth.jwt, tokens: auth.tokens }), async (c) => {
    const userId = c.get('userId') as string;
    const jti = c.get('jti') as string;
    await auth.logout.execute({ userId, jti });
    return c.body(null, 204);
  });
  return app;
};
