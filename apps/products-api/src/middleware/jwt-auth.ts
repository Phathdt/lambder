import type { JwtService, TokenStore } from '@lambder/auth';
import type { Context, Next } from 'hono';

const unauthorized = (c: Context, code = 'UNAUTHORIZED') =>
  c.json({ error: { code, message: 'Unauthorized' } }, 401);

export const jwtAuth =
  (deps: { jwt: JwtService; tokens: TokenStore }) => async (c: Context, next: Next) => {
    const header = c.req.header('authorization') ?? '';
    if (!header.startsWith('Bearer ')) return unauthorized(c);
    const token = header.slice(7);
    let claims;
    try {
      claims = await deps.jwt.verify(token);
    } catch {
      return unauthorized(c, 'INVALID_TOKEN');
    }
    if (claims.kind !== 'access') return unauthorized(c, 'INVALID_TOKEN');
    const ok = await deps.tokens.isWhitelisted(claims.sub, claims.jti);
    if (!ok) return unauthorized(c, 'TOKEN_REVOKED');
    c.set('userId', claims.sub);
    await next();
    return;
  };
