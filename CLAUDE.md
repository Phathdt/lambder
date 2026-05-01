# CLAUDE.md

Guide for Claude Code working in this repository.

## Project

**Lambder** — clean architecture monorepo deploying three Lambda functions
(two HTTP APIs + one SQS-triggered worker) behind one API Gateway, with a
React + Tailwind v4 + shadcn frontend. Targets AWS Lambda in production,
runs locally on LocalStack.

```
                       [ apps/web ]  React + Tailwind + shadcn
                             │ axios (VITE_API_BASE_URL)
                             ▼
                  [ API Gateway (REST v1) ]
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
  [ Lambda: lambder-auth-api ]  [ Lambda: lambder-products-api ]
              │                             │
              │ enqueue                     │
              │ {userId, email}             │
              │                             │
              ▼                             │
  [ SQS: lambder-emails ] ─DLQ              │
              │ event source mapping        │
              │ (batch=5, window=2s)        │
              ▼                             │
  [ Lambda: lambder-email-worker ]          │
              │                             │
              └──────────────┬──────────────┘
                             ▼
                Postgres 16 + Redis 7
```

## Stack

| Layer        | Choice                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo     | pnpm workspaces + Turborepo                                                                                                       |
| Lang         | TypeScript 5.6, Node 22                                                                                                           |
| Backend HTTP | Hono + `hono/aws-lambda`                                                                                                          |
| ORM          | Drizzle + node-postgres                                                                                                           |
| Auth         | JWT EdDSA via jose, scrypt password hashing, Redis whitelist (revocable)                                                          |
| Async        | SQS + event source mapping, fire-and-forget enqueue, DLQ (`maxReceiveCount=3`), partial-batch failures                            |
| Frontend     | React 19 + Vite + Tailwind v4 + shadcn + react-hook-form + Zod (shared with BE via `@lambder/contracts`) + TanStack Query + axios |
| Bundler      | Rolldown (production Lambda bundles, ESM, 4–23 KB per function)                                                                   |
| Lint/Format  | Oxlint + Prettier                                                                                                                 |
| Logging      | pino (JSON in Lambda, pino-pretty in dev), redacts password / authorization / tokens                                              |
| Test runners | Vitest (BE+FE unit/integration), Cucumber + Playwright (E2E BDD)                                                                  |
| LocalStack   | `localstack/localstack:3.8` (community: REST API v1, Lambda, IAM, SQS)                                                            |
| Deploy       | Custom AWS SDK script (no Serverless license)                                                                                     |

## Layout (Looper-style feature packages)

```
apps/
├── auth-api/         Hono Lambda — owns /auth/{signup,login,logout,refresh}
│                     signup also fire-and-forget enqueues UserSignedUp to SQS
├── products-api/     Hono Lambda — owns /products/* (CRUD, ownership-guarded)
├── email-worker/     SQS-triggered Lambda — no HTTP. Consumes UserSignedUp
│                     and dispatches via WelcomeEmailService → MockEmailProvider
├── web/              React frontend
└── e2e/              Cucumber + Playwright BDD tests

packages/
├── auth/             Auth feature: domain (entities, interfaces, errors),
│                     application (AuthService — needs EmailEnqueuer port),
│                     infrastructure (drizzle repo, scrypt hasher, jose JWT,
│                     Redis token-store)
├── products/         Products feature (ProductService etc.)
├── email/            Email feature: domain (Email, EmailProvider, EmailEnqueuer
│                     ports, errors), application (WelcomeEmailService),
│                     infrastructure (MockEmailProvider, SqsEmailEnqueuer)
├── contracts/        Zod schemas — single source of truth for FE+BE+SQS messages
├── shared-kernel/    Result, DomainError hierarchy, Clock, pino logger — zero
│                     runtime deps beyond pino
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
pnpm --filter email-worker dev    # local SQS poller (long-poll 5s)
pnpm --filter web dev             # :3000

# Build + deploy to LocalStack
pnpm build                        # turbo: tsc + rolldown
pnpm deploy:local                 # creates 3 Lambdas + REST API + SQS + DLQ + ESM
                                  # writes apps/web/.env.local (gateway URL)
                                  # writes apps/email-worker/.env.local (queue URL)

# Logs
pnpm logs:auth                    # tail Lambda lambder-auth-api stdout
pnpm logs:products                # tail Lambda lambder-products-api
pnpm logs:email-worker            # tail Lambda lambder-email-worker (welcome emails)

# Tests (86 BE unit + 117 FE unit + 135 BE integration + 5 E2E BDD = 338+)
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
   (`UserRepository`, `Hasher`, `JwtService`, `TokenStore`,
   `EmailProvider`, `EmailEnqueuer`).
4. **Apps** are thin adapters. HTTP apps validate (Zod), call the service,
   map `Result<T, DomainError>` to HTTP. The SQS worker parses `SQSEvent`,
   calls the service, returns `batchItemFailures` for partial-batch retries.
5. **No business logic in routes/handlers or middleware.**
6. **Async side-effects (SQS publish) are fire-and-forget** at the boundary:
   the producer (signup) logs failures but never propagates them. Reliability
   upgrade path = outbox pattern (deferred).

### Coverage targets

- BE unit ≥ 95% lines/branches/funcs
- FE unit ≥ 95% lines/branches
- BE integration ≥ 95% lines/branches
- Genuinely unreachable defensive code uses `/* c8 ignore */` with inline
  justification.

## Deploy targets

| Env                       | Gateway                                           | DB                                 | Cache             | Queue                                           |
| ------------------------- | ------------------------------------------------- | ---------------------------------- | ----------------- | ----------------------------------------------- |
| Dev (BE Hono :3001/:3002) | direct                                            | host pg                            | host redis        | local poller (`pnpm --filter email-worker dev`) |
| Dev (LocalStack)          | `http://localhost:4566/restapis/<id>/local/...`   | host pg via `host.docker.internal` | host redis        | LocalStack SQS + ESM                            |
| Prod (AWS)                | `https://<id>.execute-api.<region>.amazonaws.com` | RDS Postgres (consider RDS Proxy)  | ElastiCache Redis | SQS + ESM (alarms on DLQ)                       |

## Plan & reports

Plans live under `plans/<date>-<slug>/`:

```
plans/260430-clean-arch-lambda-monorepo/    Initial monorepo + auth + products
├── plan.md
├── phase-XX-*.md
└── reports/tester-260501-1100-{be-unit,fe-unit,be-integration}-95-coverage.md

plans/260501-2142-welcome-email-sqs/        Welcome email feature (SQS + worker)
├── plan.md
└── phase-{01..05}-*.md
```

## Pitfalls / gotchas

- **Native binaries on Lambda**: we picked Node `crypto.scrypt` over `argon2`
  to avoid per-arch native binary headaches. If switching to argon2, build
  inside `public.ecr.aws/lambda/nodejs:22`.
- **LocalStack community**: API Gateway v2 (HTTP API) is Pro-only. We use
  REST API v1. SQS + ESM are community-supported.
- **Rolldown tsconfig resolution** (1.0.0-rc.18): when bundling apps that pull
  workspace deps, set `resolve.tsconfigFilename: false` in the rolldown config
  (or use the new top-level `tsconfig` option) — the auto-resolver chokes on
  workspace `extends` chains. See `apps/email-worker/rolldown.config.mjs`.
- **pnpm deploy + Lambda zip**: pass `--config.node-linker=hoisted` for a
  flat `node_modules`, otherwise pnpm symlinks bloat the zip 15×.
- **Cross-feature DB FK** (`products.owner_id → users.id`) is added via raw
  SQL migration to keep `@lambder/auth` and `@lambder/products` decoupled.
- **SQS queue URL host vs container**: from the host we hit
  `http://localhost:4566/...`; from inside Lambda we use
  `http://sqs.<region>.localhost.localstack.cloud:4566/...`. Deploy script
  injects the container-internal URL into Lambda env.
- **Worker doesn't see queue URL**: SQS event source mapping is a control-plane
  config, not runtime — the email-worker handler receives `SQSEvent` and never
  touches the queue itself. Only `auth-api` (producer) needs `EMAIL_QUEUE_URL`.
- **LocalStack Lambda logs** are NOT in CloudWatch (community limitation);
  they live in the spawned Lambda container's stdout. Use `pnpm logs:<app>`
  helpers (`scripts/lambda-logs.sh`) instead of `awslocal logs ...`.
