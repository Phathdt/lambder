# Lambder

Clean architecture monorepo: two AWS Lambda APIs (auth + products) behind one
API Gateway, with a React + Tailwind frontend. Runs locally on LocalStack,
deploys to real AWS unchanged.

```
   apps/web  ──►  API Gateway (REST v1)  ──┬──► Lambda: lambder-auth-api
                                            └──► Lambda: lambder-products-api
                                                       │
                                                       ▼
                                             Postgres 16 + Redis 7
```

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Backend**: TypeScript + Hono on Lambda, Drizzle + node-postgres, jose JWT
  (EdDSA), `crypto.scrypt` password hashing, ioredis for JWT whitelist
- **Frontend**: React 19 + Vite + Tailwind v4 + shadcn + react-hook-form + Zod
  + TanStack Query + axios + sonner toasts
- **Validation**: Zod schemas in `@lambder/contracts` shared between FE + BE
- **Bundler**: Rolldown (ESM Lambda bundles, ~17 KB)
- **Lint/format**: Oxlint + Prettier
- **Tests**: Vitest (BE+FE unit/integration with testcontainers) + Cucumber +
  Playwright (E2E BDD) — 326 tests, coverage ≥95% across all tiers
- **Local infra**: docker-compose (Postgres + Redis + LocalStack)
- **Deploy**: AWS SDK script — no Serverless Framework license needed

## Quick start

Pre-reqs: Node 22+, pnpm 9, Docker Desktop or OrbStack.

```bash
pnpm install
pnpm gen:keys                     # writes .env.keys (JWT EdDSA pair)
cat .env.example > .env
cat .env.keys >> .env

pnpm compose:up                   # Postgres :5432, Redis :6369, LocalStack :4566
pnpm db:migrate
pnpm build
pnpm deploy:local                 # → API Gateway URL into apps/web/.env.local

pnpm --filter web dev             # opens http://localhost:3000
```

The frontend hits the LocalStack API Gateway URL (auto-set by `deploy:local`).
Sign up an account, create products, sign out — that's the demo.

For the dev BE loop (faster iteration than redeploying Lambdas), run two more
terminals:

```bash
pnpm --filter auth-api dev        # :3001
pnpm --filter products-api dev    # :3002
```

## Architecture

Clean Arch + feature packages (Looper-style):

```
packages/
├── auth/             domain (entities, interfaces, errors)
│                     application (AuthService)
│                     infrastructure (Drizzle repo, scrypt, jose, Redis)
├── products/         same shape
├── contracts/        Zod schemas (HTTP contracts) — shared with FE
├── shared-kernel/    Result<T, E>, DomainError hierarchy, Clock — zero deps
├── db/               Drizzle pool factory + migrations
├── cache/            ioredis singleton factory
└── test-utils/       Testcontainers helpers

apps/
├── auth-api/         Hono Lambda for /auth/*
├── products-api/     Hono Lambda for /products/*
├── web/              React FE (features/{auth,products})
└── e2e/              Cucumber + Playwright BDD
```

Each Lambda app is a thin HTTP layer: routes call `service.method(input)`,
map the `Result` to HTTP. Business logic lives in domain + application
layers of feature packages.

## Tests

```bash
pnpm test                         # 74 BE unit (~0.4s)
pnpm test:fe                      # 117 FE unit (~2.3s)
pnpm test:integration             # 135 BE integration with testcontainers (~22s)
pnpm test:e2e:full                # 5 E2E BDD scenarios + auto vite (~11s)

pnpm test:coverage                # HTML in coverage/unit/
pnpm test:coverage:fe             # HTML in apps/web/coverage/
pnpm test:coverage:integration    # HTML in coverage/integration/
```

| Tier | Lines | Branches | Funcs |
|---|---|---|---|
| BE unit | 100% | 100% | 100% |
| FE unit | 99.44% | 96.82% | 97.29% |
| BE integration | 97.07% | 95.62% | 93.87% |

## Deploy to real AWS

`deploy-localstack.ts` is the reference. For real AWS:

1. Set `AWS_ENDPOINT_URL=` (empty) so the SDK hits real AWS endpoints.
2. Use SSM Parameter Store for `JWT_PRIVATE_KEY_PEM`, `DATABASE_URL`, etc.
3. Put Lambdas in a VPC with subnets that route to RDS.
4. Front the API Gateway with a custom domain + ACM cert.
5. Consider RDS Proxy to handle Lambda connection pooling.

## License

MIT.
