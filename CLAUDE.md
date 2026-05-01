# CLAUDE.md

Guide for Claude Code working in this repository.

## Project

**Lambder** — clean architecture monorepo deploying two HTTP APIs as AWS Lambda
functions behind one API Gateway, with a React + Tailwind v4 + shadcn frontend.
Targets AWS Lambda in production, runs locally on LocalStack.

```
                          [ apps/web ]  React + Tailwind + shadcn
                                │ axios (VITE_API_BASE_URL)
                                ▼
                    [ API Gateway (REST v1) ]
                                │
              ┌─────────────────┴───────────────┐
              ▼                                 ▼
   [ Lambda: lambder-auth-api ]   [ Lambda: lambder-products-api ]
              │                                 │
              └────────────┬────────────────────┘
                           ▼
              Postgres 16 + Redis 7
```

## Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Lang | TypeScript 5.6, Node 22 |
| Backend HTTP | Hono + `hono/aws-lambda` |
| ORM | Drizzle + node-postgres |
| Auth | JWT EdDSA via jose, scrypt password hashing, Redis whitelist (revocable) |
| Frontend | React 19 + Vite + Tailwind v4 + shadcn + react-hook-form + Zod (shared with BE via `@lambder/contracts`) + TanStack Query + axios |
| Bundler | Rolldown (production Lambda bundles, ESM, ~17KB inlined) |
| Lint/Format | Oxlint + Prettier |
| Test runners | Vitest (BE+FE unit/integration), Cucumber + Playwright (E2E BDD) |
| LocalStack | `localstack/localstack:3.8` (community: REST API v1, Lambda, IAM) |
| Deploy | Custom AWS SDK script (no Serverless license) |

## Layout (Looper-style feature packages)

```
apps/
├── auth-api/         Hono Lambda — owns /auth/{signup,login,logout,refresh}
├── products-api/     Hono Lambda — owns /products/* (CRUD)
├── web/              React frontend
└── e2e/              Cucumber + Playwright BDD tests

packages/
├── auth/             Auth feature: domain (entities, interfaces, errors),
│                     application (AuthService), infrastructure (drizzle repo,
│                     argon2/scrypt hasher, jose JWT, Redis token-store)
├── products/         Products feature (ProductService etc.)
├── contracts/        Zod schemas — single source of truth for FE+BE
├── shared-kernel/    Result, DomainError hierarchy, Clock — zero deps
├── db/               Drizzle pg pool factory + migrations
├── cache/            ioredis singleton factory
├── tsconfig/         tsconfig presets (base, lib, app, react-app)
└── test-utils/       Testcontainers helpers (startPostgres, startRedis,
                       generateTestJwtKeys)

infrastructure/
├── docker/           Lambda container Dockerfile (fallback path)
└── localstack/       LocalStack init scripts

scripts/
├── deploy-localstack.ts   Build + deploy two Lambdas + REST API Gateway
└── generate-jwt-keys.ts   EdDSA keypair → .env

dist/                 Build output (root-consolidated)
├── packages/<name>/  TS compile per package
└── apps/<name>/main.js  Rolldown ESM bundles for Lambda
```

## Daily commands

```bash
# Bootstrap
pnpm install
pnpm gen:keys                     # generates .env.keys → merge into .env
pnpm compose:up                   # Postgres 5432, Redis 6369, LocalStack 4566
pnpm db:migrate                   # Drizzle migrations

# Dev (each in separate terminal)
pnpm --filter auth-api dev        # :3001
pnpm --filter products-api dev    # :3002
pnpm --filter web dev             # :3000

# Build + deploy to LocalStack
pnpm build                        # turbo: tsc + rolldown
pnpm deploy:local                 # creates 2 Lambdas + 1 REST API; writes
                                  # apps/web/.env.local with gateway URL

# Tests
pnpm test                         # BE unit (vitest threads, ~0.4s)
pnpm test:fe                      # FE unit (vitest jsdom, ~2.3s)
pnpm test:integration             # BE integration (vitest forks parallel, ~22s)
pnpm test:e2e                     # E2E (cucumber parallel, FE must be running)
pnpm test:e2e:full                # auto-starts FE + runs E2E + tears down

pnpm test:coverage                # BE unit coverage HTML → coverage/unit/
pnpm test:coverage:fe             # FE coverage HTML → apps/web/coverage/
pnpm test:coverage:integration    # BE integration HTML → coverage/integration/
```

## Conventions

### File naming (Looper-style)

```
<entity>.entity.ts              user.entity.ts
<entity>.repository.ts          user.repository.ts        (interface in domain/)
<entity>.<provider>-repository.ts user.drizzle-repository.ts (impl in infra/)
<service>.service.ts            auth.service.ts
<feature>.module.ts             auth.module.ts            (composition root)
```

### Test colocation (Go-style)

Tests sit next to their source file:
```
foo.ts + foo.test.ts             unit
foo.ts + foo.integration.spec.ts integration
```

Shared helpers/fakes live in sentinel directories that are excluded from
both test discovery and coverage:
- `__test-fakes__/` — in-memory port implementations
- `__test-helpers__/` — Hono app builders for testcontainer-backed runs
- `__test-utils__/` — RTL render helpers (FE)

### Imports

Drop `.js` extensions in source files (Bundler module resolution). Apps import
features via `@lambder/<pkg>` workspace aliases.

### Architecture rules

1. **Domain layer** (`packages/<feature>/src/domain/`) has zero runtime deps
   beyond `zod` (and only via `@lambder/contracts`).
2. **Application services** are concrete classes implementing a domain
   interface. Constructor injection only — no DI containers.
3. **Infrastructure adapters** are concrete classes implementing domain ports
   (`UserRepository`, `Hasher`, `JwtService`, `TokenStore`).
4. **Apps** are thin HTTP wirings. Routes only validate (Zod), call the
   service, map `Result<T, DomainError>` to HTTP.
5. **No business logic in routes or middleware.**

### Coverage targets

- BE unit ≥ 95% lines/branches/funcs
- FE unit ≥ 95% lines/branches
- BE integration ≥ 95% lines/branches
- Genuinely unreachable defensive code uses `/* c8 ignore */` with inline
  justification.

## Deploy targets

| Env | Gateway | DB | Cache |
|---|---|---|---|
| Dev (BE Hono :3001/:3002) | direct | host pg | host redis |
| Dev (LocalStack) | `http://localhost:4566/restapis/<id>/local/...` | host pg via `host.docker.internal` | host redis |
| Prod (AWS) | `https://<id>.execute-api.<region>.amazonaws.com` | RDS Postgres (consider RDS Proxy) | ElastiCache Redis |

## Plan & reports

The current implementation plan and tester reports live at:
```
plans/260430-clean-arch-lambda-monorepo/
├── plan.md
├── phase-XX-*.md
└── reports/tester-260501-1100-{be-unit,fe-unit,be-integration}-95-coverage.md
```

## Pitfalls / gotchas

- **Native binaries on Lambda**: we picked Node `crypto.scrypt` over `argon2`
  to avoid per-arch native binary headaches. If switching to argon2, build
  inside `public.ecr.aws/lambda/nodejs:22`.
- **LocalStack community**: API Gateway v2 (HTTP API) is Pro-only. We use
  REST API v1.
- **Rolldown 1.0.0-rc.18 quirk**: previously couldn't honor absolute
  `output.file`; we use `output.dir` + `entryFileNames` instead.
- **pnpm deploy + Lambda zip**: pass `--config.node-linker=hoisted` for a
  flat `node_modules`, otherwise pnpm symlinks bloat the zip 15×.
- **Cross-feature DB FK** (`products.owner_id → users.id`) is added via raw
  SQL migration to keep `@lambder/auth` and `@lambder/products` decoupled.
