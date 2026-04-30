# Phase 09 — Testing + CI

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-08](./phase-08-docker-rds.md)

## Overview
- **Priority**: P1 (ship-blocker before merging to main, but not before basic feature work)
- **Status**: Not started
- Vitest unit tests on `packages/core` (pure logic, fast). Integration tests on apps using **Testcontainers** (real Postgres + Redis). GitHub Actions runs lint, typecheck, test, build on every PR.

## Key Insights
- `packages/core` should hit > 80% coverage trivially because it's pure functions.
- For app integration tests, spin Postgres + Redis via Testcontainers; **no LocalStack needed in tests** — call the Hono app directly via `app.request(...)` (Hono provides this).
- Run a separate "deploy smoke" job that does `pnpm deploy:local` against LocalStack only on `main` pushes to keep PR feedback fast.

## Requirements
- Functional
  - `pnpm test` runs all package + app tests
  - `pnpm test:coverage` produces coverage report; CI fails below 80% on `packages/core`
  - GitHub Actions: lint + typecheck + test + build on every PR
  - Optional `deploy:local` smoke job on main
- Non-functional
  - Total CI time per PR < 5 min
  - No flakiness from Testcontainers (use `pgvector/pgvector:pg16` cached image)

## Architecture

### Test layout
```
packages/core/test/
├── auth/
│   ├── signup.test.ts
│   ├── login.test.ts
│   └── refresh-token.test.ts
└── products/
    └── update-product.test.ts

apps/auth-api/test/
├── integration/
│   └── auth-flow.test.ts        # signup → login → logout via app.request
└── helpers/
    ├── containers.ts            # Testcontainers Postgres + Redis bootstrap
    └── build-test-app.ts        # buildApp(deps) with overrides

apps/products-api/test/
└── integration/
    └── product-crud.test.ts
```

### Vitest config
```ts
// vitest.config.ts (root, shared via project references)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, functions: 80, branches: 75 },
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.d.ts'],
    },
    pool: 'threads',
    poolOptions: { threads: { singleThread: false } },
    environment: 'node',
  },
});
```

### Testcontainers helper
```ts
// apps/auth-api/test/helpers/containers.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';

export async function startStack() {
  const pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  const redis = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379).start();
  return {
    databaseUrl: pg.getConnectionUri(),
    redisUrl: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
    stop: async () => { await pg.stop(); await redis.stop(); },
  };
}
```

### Sample integration test
```ts
// apps/auth-api/test/integration/auth-flow.test.ts
import { beforeAll, afterAll, test, expect } from 'vitest';
import { startStack } from '../helpers/containers.js';
import { buildApp } from '../../src/app.js';
import { buildContainerWithEnv } from '../helpers/build-test-app.js';

let env: Awaited<ReturnType<typeof startStack>>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  env = await startStack();
  process.env.DATABASE_URL = env.databaseUrl;
  process.env.REDIS_URL = env.redisUrl;
  // run drizzle migrations
  app = buildApp(buildContainerWithEnv());
}, 60_000);

afterAll(async () => { await env.stop(); });

test('signup → login → logout', async () => {
  const signup = await app.request('/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.com', password: 'StrongPass1!@' }),
  });
  expect(signup.status).toBe(201);

  const login = await app.request('/auth/login', { /* ... */ });
  const { accessToken } = await login.json();
  expect(login.status).toBe(200);

  const logout = await app.request('/auth/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(logout.status).toBe(204);
});
```

### GitHub Actions (`.github/workflows/ci.yml`)
```yaml
name: ci
on: { pull_request: {}, push: { branches: [main] } }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck build
      - run: pnpm turbo run test -- --coverage
      - uses: codecov/codecov-action@v4
        if: always()
  deploy-local-smoke:
    if: github.ref == 'refs/heads/main'
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: docker compose up -d
      - run: pnpm build
      - run: pnpm deploy:local
      - run: ./scripts/smoke-test.sh
```

## Files to Create
- `vitest.config.ts` (root)
- `packages/core/test/**/*.test.ts` (use-case unit tests)
- `apps/auth-api/test/integration/auth-flow.test.ts`
- `apps/auth-api/test/helpers/containers.ts`
- `apps/auth-api/test/helpers/build-test-app.ts`
- `apps/products-api/test/integration/product-crud.test.ts`
- `.github/workflows/ci.yml`
- `scripts/smoke-test.sh`

## Implementation Steps
1. Add `vitest`, `@vitest/coverage-v8`, `testcontainers`, `@testcontainers/postgresql` as devDeps.
2. Write unit tests for every use case (mock ports with simple in-memory fakes — fastest).
3. Write 1 integration test per app covering the happy path.
4. Author `vitest.config.ts` + per-package `test` script.
5. Author `ci.yml`.
6. Author `scripts/smoke-test.sh` that hits LocalStack endpoints to confirm a green deploy.

## Todo List
- [ ] Vitest installed + configured
- [ ] Unit tests for all 9 use cases (4 auth + 5 products)
- [ ] 1 integration test per app
- [ ] CI workflow runs lint+typecheck+test+build on PRs
- [ ] Coverage > 80% on `packages/core`
- [ ] Smoke deploy job passes on main

## Success Criteria
- Local: `pnpm test` runs in < 60s; integration tests in < 90s
- CI: PR pipeline < 5 min total
- Code coverage gate enforced
- `scripts/smoke-test.sh` exits 0 against fresh LocalStack

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Testcontainers slow on CI | Use Docker layer cache via `actions/cache`; reuse one container across files via `globalSetup` |
| LocalStack flaky in CI | Pin image SHA; bound deploy step with `timeout-minutes: 10` |
| Coverage gate brittle | Only enforce on `packages/core`; apps measured but not gated |

## Security Considerations
- CI never echoes secrets; `JWT_*` keys generated fresh per CI run.
- Codecov upload uses tokenless mode for public repos; private repos use OIDC.

## Next Steps
- Plan complete. Hand off to implementation: start with phase 01.
