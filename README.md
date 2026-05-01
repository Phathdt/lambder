# Lambder

Clean architecture monorepo: three AWS Lambda functions (auth + products + email
worker) wired through API Gateway and SQS, with a React + Tailwind frontend.
Runs locally on LocalStack, deploys to real AWS unchanged.

```
   apps/web ──► API Gateway (REST v1) ──┬──► Lambda lambder-auth-api ──┐
                                        │           │                  │
                                        └──► Lambda lambder-products-api │
                                                    │                  │
                                                    ▼                  │ enqueue
                                          Postgres 16 + Redis 7        │ {userId,email}
                                                                       ▼
                                                              SQS lambder-emails
                                                                       │ event source mapping
                                                                       ▼ (batch=5, window=2s)
                                                              Lambda lambder-email-worker
                                                                       │
                                                                       └─► MockEmailProvider
                                                                            (pino "email.sent")

                                                              SQS DLQ (after 3 retries)
```

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Backend**: TypeScript + Hono on Lambda, Drizzle + node-postgres, jose JWT
  (EdDSA), `crypto.scrypt` password hashing, ioredis for JWT whitelist
- **Async**: SQS + event source mapping, fire-and-forget enqueue, DLQ with
  `maxReceiveCount=3`, partial-batch failure responses
- **Frontend**: React 19 + Vite + Tailwind v4 + shadcn + react-hook-form + Zod
  + TanStack Query + axios + sonner toasts
- **Validation**: Zod schemas in `@lambder/contracts` shared between FE + BE
- **Bundler**: Rolldown (ESM Lambda bundles, ~4–23 KB per function)
- **Lint/format**: Oxlint + Prettier
- **Logging**: pino (JSON in Lambda, pino-pretty in dev) with secret redaction
- **Tests**: Vitest (BE+FE unit/integration with testcontainers) + Cucumber +
  Playwright (E2E BDD) — 338 tests, coverage ≥95% across all tiers
- **Local infra**: docker-compose (Postgres + Redis + LocalStack with `sqs`)
- **Deploy**: AWS SDK script — no Serverless Framework license needed

## Quick start

Pre-reqs: Node 22+, pnpm 9, Docker Desktop or OrbStack.

```bash
pnpm install
pnpm gen:keys                     # writes .env.keys (JWT EdDSA pair)
cat .env.example > .env
cat .env.keys >> .env

pnpm compose:up                   # Postgres :5432, Redis :6369, LocalStack :4566 (sqs+lambda+apigw)
pnpm db:migrate
pnpm build
pnpm deploy:local                 # creates 3 Lambdas, REST API gateway, SQS+DLQ, ESM
                                  # → writes API Gateway URL into apps/web/.env.local
                                  # → writes EMAIL_QUEUE_URL into apps/email-worker/.env.local

pnpm --filter web dev             # opens http://localhost:3000
```

The frontend hits the LocalStack API Gateway URL (auto-set by `deploy:local`).
Sign up an account → SQS message produced → email-worker picks it up → check
`pnpm logs:email-worker` for the JSON-logged email payload.

For the dev BE loop (faster than redeploying Lambdas), run more terminals:

```bash
pnpm --filter auth-api dev        # :3001 (HTTP)
pnpm --filter products-api dev    # :3002 (HTTP)
pnpm --filter email-worker dev    # local SQS poller (long-poll, 5s)
```

## Architecture

Clean Arch + feature packages (Looper-style):

```
packages/
├── auth/             domain (entities, interfaces, errors)
│                     application (AuthService — accepts EmailEnqueuer port)
│                     infrastructure (Drizzle repo, scrypt, jose, Redis)
├── products/         same shape (ProductService, ownership rules)
├── email/            domain (Email, EmailProvider, EmailEnqueuer ports)
│                     application (WelcomeEmailService)
│                     infrastructure (MockEmailProvider, SqsEmailEnqueuer)
├── contracts/        Zod schemas (HTTP + SQS message contracts) — shared with FE
├── shared-kernel/    Result<T, E>, DomainError hierarchy, Clock, pino logger
├── db/               Drizzle pool factory + migrations
├── cache/            ioredis singleton factory
└── test-utils/       Testcontainers helpers (PG + Redis + JWT keys)

apps/
├── auth-api/         Hono Lambda for /auth/*
│                     (signup → fire-and-forget enqueue welcome email)
├── products-api/     Hono Lambda for /products/* (JWT-guarded mutations)
├── email-worker/     SQS-triggered Lambda (no HTTP)
│                     parses SQSEvent → WelcomeEmailService → log
├── web/              React FE (features/{auth,products})
└── e2e/              Cucumber + Playwright BDD
```

Each Lambda is a thin adapter: routes/handler call `service.method(input)` and
map the `Result` to HTTP/SQS response. Business logic lives in domain +
application layers of feature packages.

### Welcome email flow

```
POST /auth/signup
  → AuthService.signup()
    ├─ users.create()                       (DB)
    └─ emailEnqueuer.enqueueWelcome(...)    (SQS, fire-and-forget)
                                              ↓
                                    SQS lambder-emails-local
                                              ↓ event source mapping
                                    email-worker.handle(SQSEvent)
                                              ↓
                                    WelcomeEmailService.execute()
                                              ↓
                                    MockEmailProvider.send()
                                              ↓
                                    pino.info({to,subject,body}, 'email.sent')
```

Failure modes:
- SQS down at signup → log error, **signup still returns 201** (best-effort).
- Worker throws → SQS redrives up to 3× → DLQ.
- Bad message body → reported via `batchItemFailures`, only that one redrives.

## Tests

```bash
pnpm test                         # 86 BE unit (~0.4s)
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
| FE unit | 99.4% | 96.8% | 97.3% |
| BE integration | 97.1% | 95.6% | 93.9% |

## Observability

```bash
pnpm logs:auth                    # tail auth-api Lambda container stdout
pnpm logs:products                # tail products-api
pnpm logs:email-worker            # tail email-worker (welcome emails)
pnpm compose:logs                 # postgres + redis + localstack
```

pino emits structured JSON with redaction (password / authorization /
accessToken / refreshToken never reach logs). Each request gets a child
logger with `requestId` and duration.

## SQS debugging

```bash
# Inspect main queue
awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/lambder-emails-local \
  --attribute-names ApproximateNumberOfMessages

# Drain DLQ (poison messages after 3 retries)
awslocal sqs receive-message --queue-url $DLQ_URL
```

## Deploy to real AWS

`deploy-localstack.ts` is the reference. For real AWS:

1. Unset `AWS_ENDPOINT_URL` so the SDK hits real AWS endpoints.
2. Use SSM Parameter Store for `JWT_PRIVATE_KEY_PEM`, `DATABASE_URL`,
   `EMAIL_QUEUE_URL`, etc.
3. Put HTTP Lambdas in a VPC with subnets that route to RDS + ElastiCache.
4. Front the API Gateway with a custom domain + ACM cert.
5. Consider RDS Proxy to handle Lambda connection pooling.
6. Add a CloudWatch alarm on DLQ `ApproximateNumberOfMessagesVisible > 0`.
7. Swap `MockEmailProvider` for an SES / Resend / Postmark adapter
   (single file in `packages/email/src/infrastructure/providers/`).

## License

MIT.
