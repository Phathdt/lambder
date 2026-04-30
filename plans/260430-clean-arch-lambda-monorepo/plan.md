---
title: Clean Architecture Lambda Monorepo
slug: clean-arch-lambda-monorepo
date: 2026-04-30
status: scaffolded
owner: Kane Hoang
blockedBy: []
blocks: []
tags: [monorepo, turborepo, lambda, serverless, hono, drizzle, oxlint, prettier]
---

## Implementation Status (2026-04-30)
All 9 phases scaffolded. Pending: `pnpm install`, `pnpm db:generate`, `pnpm gen:keys`, real LocalStack deploy.

# Clean Architecture Lambda Monorepo

## Goal
Build a production-ready monorepo (Turborepo + pnpm + TypeScript) that ships **two AWS Lambda functions** (Auth + Products) behind API Gateway, bundled with **Rolldown**, written in **Clean Architecture** style. Local dev runs against **LocalStack + Postgres + Redis** in Docker; production targets **AWS Lambda + RDS + ElastiCache**.

## Stack (decided)
| Layer | Choice | Why |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Cache, task graph, lightweight |
| Bundler | Rolldown (production) / tsx (dev) | Rust-based, ESM-first, tree-shaking |
| Runtime | Node.js 22.x on Lambda (arm64) | Newer V8, lower cost |
| Framework | Hono + `@hono/node-server` + `hono/aws-lambda` | Cold start ~30ms, edge-ready |
| ORM | Drizzle ORM + `pg` driver | ~10kb, no engine binary, fast cold starts |
| Auth | JWT (jose) + Redis whitelist | Stateless + revocable |
| IaC | Serverless Framework v4 + serverless-localstack | Fastest path, native LocalStack adapter |
| DB | Postgres 16 (Docker) → RDS Postgres in prod | Same engine end-to-end |
| Cache | Redis 7 (Docker) → ElastiCache in prod | JWT whitelist, refresh token store |
| Tests | Vitest + supertest + Testcontainers | Fast, ESM-native |
| Lint | Oxlint (Rust-based) | 50-100x faster than ESLint |
| Format | Prettier | Industry standard |
| CI | GitHub Actions | Default for OSS-style monorepos |

## Top-level layout (Looper-style feature packages)
```
lambder/
├── apps/
│   ├── auth-api/           # Hono Lambda handler — only HTTP wiring
│   │   └── src/
│   │       ├── main.ts                   # Lambda entry
│   │       ├── app.ts                    # Hono builder
│   │       ├── routes/                   # signup/login/logout/refresh
│   │       └── middleware/               # error mapper, jwt guard
│   └── products-api/       # Hono Lambda handler — only HTTP wiring
│       └── src/
│           ├── main.ts
│           ├── app.ts
│           └── routes/                   # list/get/create/update/delete
├── packages/
│   ├── auth/               # Auth feature package (Clean Arch)
│   │   └── src/
│   │       ├── application/services/
│   │       │   ├── signup.service.ts
│   │       │   ├── login.service.ts
│   │       │   ├── logout.service.ts
│   │       │   └── refresh.service.ts
│   │       ├── domain/
│   │       │   ├── entities/user.entity.ts
│   │       │   ├── interfaces/
│   │       │   │   ├── user.repository.ts
│   │       │   │   ├── token-store.ts
│   │       │   │   ├── hasher.ts
│   │       │   │   └── jwt-service.ts
│   │       │   └── errors.ts
│   │       ├── infrastructure/
│   │       │   ├── repositories/user.drizzle-repository.ts
│   │       │   ├── crypto/argon2.hasher.ts
│   │       │   ├── crypto/jose-jwt.service.ts
│   │       │   ├── cache/redis-token.store.ts
│   │       │   └── db/auth.schema.ts     # users table
│   │       ├── auth.module.ts            # composition root
│   │       └── index.ts
│   ├── products/           # Products feature package (Clean Arch)
│   │   └── src/
│   │       ├── application/services/product.service.ts
│   │       ├── domain/
│   │       │   ├── entities/product.entity.ts
│   │       │   ├── interfaces/product.repository.ts
│   │       │   └── errors.ts
│   │       ├── infrastructure/
│   │       │   ├── repositories/product.drizzle-repository.ts
│   │       │   └── db/products.schema.ts # products table
│   │       ├── products.module.ts
│   │       └── index.ts
│   ├── contracts/          # Zod schemas (HTTP contracts)
│   ├── shared-kernel/      # Result, base errors, Clock — zero deps
│   ├── db/                 # Drizzle pool factory + schema barrel
│   ├── cache/              # ioredis client factory
│   └── tsconfig/           # Shared tsconfig presets
├── infrastructure/
│   ├── docker/             # Dockerfile (Lambda container image)
│   └── localstack/         # init scripts
├── plans/  docs/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── docker-compose.yml      # postgres + redis + localstack
└── .env.example
```

### File-naming convention (Looper-style)
- `<entity>.entity.ts` — pure data class/interface
- `<entity>.repository.ts` — port (interface) inside `domain/interfaces/`
- `<entity>.<provider>-repository.ts` — adapter inside `infrastructure/repositories/` (e.g. `user.drizzle-repository.ts`)
- `<feature>.<role>.ts` — services: `signup.service.ts`, `argon2.hasher.ts`
- `<feature>.module.ts` — composition root for the feature

## Phases
1. [Phase 01 — Monorepo bootstrap](./phase-01-monorepo-bootstrap.md) — pnpm workspaces, Turborepo, tsconfig presets, Oxlint+Prettier, Rolldown
2. [Phase 02 — Shared infra packages](./phase-02-shared-packages.md) — `contracts`, `shared-kernel`, `db`, `cache` (cross-feature primitives only)
3. [Phase 03 — Auth feature package](./phase-03-database-redis.md) — `packages/auth` with full Clean Arch (domain/application/infrastructure) including Drizzle `users` schema + Redis token store
4. [Phase 04 — Products feature package + Auth API app](./phase-04-auth-api.md) — `packages/products` Clean Arch + `apps/auth-api` HTTP wiring
5. [Phase 05 — Products API app](./phase-05-products-api.md) — `apps/products-api` HTTP wiring with JWT guard
6. [Phase 06 — Rolldown bundling for Lambda](./phase-06-rolldown-lambda-bundle.md) — rolldown config, externals, source maps
7. [Phase 07 — LocalStack + Serverless Framework](./phase-07-localstack-serverless.md) — `serverless.yml`, API Gateway, deploy local + AWS
8. [Phase 08 — Docker setup](./phase-08-docker-rds.md) — `docker-compose.yml` (pg/redis/localstack), Lambda container image Dockerfile
9. [Phase 09 — Testing + CI](./phase-09-testing-ci.md) — Vitest unit + integration (Testcontainers), GitHub Actions

## Key constraints
- **Cold start budget**: < 250ms p95 per Lambda → bundle < 5MB, no Prisma engine, no AWS SDK v2 in bundle (use v3 + tree-shake).
- **Connection pooling**: Use `pg` Pool with `max=1` per Lambda invocation; consider RDS Proxy in prod (note in phase-07).
- **JWT revocation**: Refresh tokens stored in Redis with TTL = refresh exp; logout deletes the entry; access tokens checked against Redis whitelist on each request (decision documented in phase-04).
- **No business logic in handlers**: Handlers = HTTP adapters only. All logic lives in `packages/core`.

## Out of scope
- Email verification flow (only signup/login/logout/refresh)
- RBAC beyond "authenticated user owns product"
- Rate limiting (TODO post-MVP)
- Observability (Datadog/X-Ray) — placeholder only

## Success criteria
- `pnpm dev` boots compose stack + both APIs against LocalStack API Gateway
- `curl localhost:4566/...` returns 200 for full happy path: signup → login → create product → get product → delete product → logout
- `pnpm build` produces deployable `.zip` artifacts < 5MB each via Rolldown
- `pnpm deploy:local` deploys to LocalStack; `pnpm deploy:aws` deploys to real AWS (with proper creds)
- All tests pass in CI with coverage > 80% on `packages/core`

## Risks
| Risk | Mitigation |
|---|---|
| Rolldown ESM/Lambda interop quirks | Phase 06 includes a smoke-test Lambda before wiring real apps |
| Drizzle migrations on RDS | Run migrations from a separate "migrate" Lambda or one-off ECS task; documented in phase-07 |
| LocalStack Pro features (RDS) | Use Postgres in Docker for dev, point Lambda env at host.docker.internal |
| pg Pool exhaustion on Lambda | `max=1`, `idleTimeoutMillis` short, document RDS Proxy for prod |
