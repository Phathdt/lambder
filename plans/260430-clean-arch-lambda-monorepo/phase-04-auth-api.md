# Phase 04 — Auth API (signup / login / logout / refresh)

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-02](./phase-02-shared-packages.md), [phase-03](./phase-03-database-redis.md)

## Overview
- **Priority**: P0
- **Status**: Not started
- Build the first Lambda app: `apps/auth-api`. Hono router + 4 endpoints, Argon2id password hashing, JWT (access + refresh) signed with EdDSA via `jose`, Redis whitelist for revocation.

## Key Insights
- **Argon2id** > bcrypt for new systems (memory-hard). `argon2` package binds to native libargon2 — needs Lambda Layer or native compile in container build (handled in phase 06/08).
- **EdDSA (Ed25519)** keys are 32 bytes → smaller signatures, faster verify than RS256.
- **Whitelist > blacklist**: token is valid only if `jwt:wl:{userId}:{jti}` exists in Redis. Logout = `DEL` that key. TTL on the Redis key matches token expiry → no garbage cleanup needed.
- **Refresh rotation**: each refresh issues a new access + new refresh, revokes old refresh `jti` in Redis. Detects token reuse → revoke all sessions for that user.

## Requirements
- Functional
  - `POST /auth/signup` — body: `{ email, password }` → 201 `{ user: { id, email } }` (no auto-login per spec)
  - `POST /auth/login` — body: `{ email, password }` → 200 `{ accessToken, refreshToken, expiresIn }`
  - `POST /auth/logout` — auth header required → 204; revokes both access + refresh
  - `POST /auth/refresh` — body: `{ refreshToken }` → 200 new pair; rotates
  - All errors → consistent shape `{ error: { code, message } }` from `@lambder/contracts`
- Non-functional
  - Password ≥ 12 chars, ≥ 1 upper, ≥ 1 digit, ≥ 1 symbol (Zod refinement)
  - Access TTL: 15 min; Refresh TTL: 7 days (env-overridable)
  - Cold start budget: < 250ms p95

## Architecture

### App layout
```
apps/auth-api/
├── src/
│   ├── handler.ts                  # Lambda entry: handle = aws-lambda hono adapter
│   ├── app.ts                      # Hono app builder (testable)
│   ├── routes/
│   │   ├── signup.ts
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   └── refresh.ts
│   ├── middleware/
│   │   ├── error-mapper.ts         # DomainError → HTTP
│   │   └── jwt-auth.ts             # access token guard (used by /logout)
│   └── di.ts                       # composition root: builds use cases from infra
├── rolldown.config.ts
├── serverless.yml                  # see phase 07
└── package.json
```

### Hono handler shape
```ts
// apps/auth-api/src/handler.ts
import { handle } from 'hono/aws-lambda';
import { buildApp } from './app.js';
export const handler = handle(buildApp());
```

```ts
// apps/auth-api/src/app.ts
import { Hono } from 'hono';
import { signupRoute } from './routes/signup.js';
import { loginRoute } from './routes/login.js';
import { logoutRoute } from './routes/logout.js';
import { refreshRoute } from './routes/refresh.js';
import { errorMapper } from './middleware/error-mapper.js';
import { buildContainer } from './di.js';

export const buildApp = (deps = buildContainer()) => {
  const app = new Hono();
  app.onError(errorMapper);
  app.route('/auth', signupRoute(deps));
  app.route('/auth', loginRoute(deps));
  app.route('/auth', logoutRoute(deps));
  app.route('/auth', refreshRoute(deps));
  return app;
};
```

### JWT service (infra)
```ts
// packages/infra/src/crypto/jose-jwt-service.ts
import { SignJWT, jwtVerify, generateKeyPair } from 'jose';
export class JoseJwtService implements JwtService {
  constructor(private privKey: KeyLike, private pubKey: KeyLike) {}
  async sign(payload: JwtPayload, ttlSeconds: number) {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.privKey);
  }
  async verify(token: string) { return jwtVerify(token, this.pubKey); }
}
```

Keys loaded from env (`JWT_PRIVATE_KEY_PEM`, `JWT_PUBLIC_KEY_PEM`); generated once via `pnpm gen:keys` script.

### Use case wiring
- `signup`: validate body → hash password → `users.create` → return public user.
- `login`: find by email + hash → verify → sign access+refresh → whitelist both `jti`s in Redis → return.
- `logout`: extract access claims (already verified by middleware) → revoke access+refresh `jti`s.
- `refresh`: verify refresh → check whitelisted → revoke old → mint new pair → whitelist new.

## Files to Create
- `apps/auth-api/package.json` (deps: `hono`, `@lambder/core`, `@lambder/infra`, `@lambder/contracts`)
- `apps/auth-api/src/handler.ts`
- `apps/auth-api/src/app.ts`
- `apps/auth-api/src/di.ts`
- `apps/auth-api/src/routes/{signup,login,logout,refresh}.ts`
- `apps/auth-api/src/middleware/error-mapper.ts`
- `apps/auth-api/src/middleware/jwt-auth.ts`
- `packages/contracts/src/auth-schemas.ts`:
```ts
export const signupBody = z.object({
  email: z.string().email(),
  password: z.string().min(12).regex(/[A-Z]/).regex(/\d/).regex(/[^a-zA-Z0-9]/),
});
export const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) });
export const refreshBody = z.object({ refreshToken: z.string() });
```
- `packages/core/src/use-cases/auth/{signup,login,logout,refresh-token}.ts` — concrete implementations
- `scripts/generate-jwt-keys.ts` — uses `jose.generateKeyPair('EdDSA')` + writes PEM to `.env.local`

## Implementation Steps
1. Flesh out `packages/contracts/src/auth-schemas.ts` and re-export.
2. Implement `signup` use case: pure function, returns `Result<PublicUser, ConflictError>`.
3. Implement `login` use case: returns `Result<{access, refresh, exp}, AuthError>`.
4. Implement `logout` and `refresh` use cases.
5. Implement Hono routes; each route only validates with Zod, calls use case, maps Result to HTTP.
6. Implement `error-mapper` (DomainError→4xx, unknown→500).
7. Implement `jwt-auth` middleware (verify + Redis whitelist check).
8. Wire `di.ts` (composition root for this app).
9. Write `scripts/generate-jwt-keys.ts`.
10. Run app locally with `tsx watch src/handler.ts` via a tiny `dev-server.ts` that wraps Hono in `@hono/node-server`.

## Todo List
- [ ] Auth Zod schemas in `contracts`
- [ ] `signup` use case + unit tests
- [ ] `login` use case + unit tests
- [ ] `logout` + `refresh` use cases + unit tests
- [ ] Hono routes + error mapper
- [ ] JWT auth middleware
- [ ] Composition root (`di.ts`)
- [ ] Local dev server boots + happy path passes via `curl`

## Success Criteria
- `curl -X POST localhost:3001/auth/signup …` returns 201
- `curl -X POST localhost:3001/auth/login …` returns tokens
- `curl -X POST localhost:3001/auth/logout -H 'authorization: Bearer …'` returns 204
- After logout, the access token fails (Redis whitelist miss → 401)
- Unit tests cover password validation, duplicate email, wrong password, expired token

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Argon2 native binary in Lambda zip | Phase 06: build inside `public.ecr.aws/lambda/nodejs:22` container OR use Lambda Layer; pure-JS fallback `argon2-browser` if blocking |
| Refresh-token reuse race | Detect: if revoked refresh is presented, `revokeAll(userId)` and 401 |

## Security Considerations
- Argon2id params: `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1` (OWASP recommendation).
- Never log password, hash, or tokens.
- `email` lookup uses `LOWER(email)` index to prevent enumeration via case variation.
- Generic 401 message on login failure (no "user not found" leak).

## Next Steps
- Phase 05 reuses the JWT middleware in `products-api`.
