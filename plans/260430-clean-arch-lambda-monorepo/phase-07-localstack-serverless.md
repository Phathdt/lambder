# Phase 07 — LocalStack + Serverless Framework

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-06](./phase-06-rolldown-lambda-bundle.md)

## Overview
- **Priority**: P0
- **Status**: Not started
- Wire both Lambda apps to API Gateway via Serverless Framework v4. Local deploys go to LocalStack (`endpoint: http://localhost:4566`); production deploys go to real AWS. Same `serverless.yml`, just different stage/profile.

## Key Insights
- `serverless-localstack` plugin auto-redirects every AWS endpoint when `stage = local`.
- LocalStack **community edition** supports Lambda + API Gateway + S3 + DynamoDB — but **NOT RDS**. Solution: keep Postgres in Docker compose, point Lambda env at `host.docker.internal:5432` (or the compose network alias when LocalStack runs on the same docker network).
- Use **HTTP API (v2)** instead of REST API — cheaper, faster, simpler to wire.
- Each app gets its own `serverless.yml` (clean separation, can deploy independently). A root `serverless-compose.yml` orchestrates both.

## Requirements
- Functional
  - `pnpm deploy:local` → both Lambdas reachable at `http://localhost:4566/restapis/.../...`
  - `pnpm deploy:aws --stage dev` → real AWS deployment
  - Env vars (DB, Redis, JWT keys) injected per stage from SSM Parameter Store (prod) or `.env.local` (local)
- Non-functional
  - Lambda runtime: `nodejs22.x`, arch: `arm64`, memory: 512 MB, timeout: 10s
  - VPC config for prod (RDS + ElastiCache access) — documented, not enabled in local
  - API Gateway logging on for prod (CloudWatch)

## Architecture

### Per-app `serverless.yml` (auth-api)
```yaml
service: lambder-auth-api
frameworkVersion: "4"
plugins:
  - serverless-localstack

provider:
  name: aws
  runtime: nodejs22.x
  architecture: arm64
  memorySize: 512
  timeout: 10
  stage: ${opt:stage, 'local'}
  region: ${opt:region, 'ap-southeast-1'}
  environment:
    NODE_OPTIONS: --enable-source-maps
    DATABASE_URL: ${env:DATABASE_URL}
    REDIS_URL: ${env:REDIS_URL}
    JWT_PRIVATE_KEY_PEM: ${env:JWT_PRIVATE_KEY_PEM}
    JWT_PUBLIC_KEY_PEM: ${env:JWT_PUBLIC_KEY_PEM}
    JWT_ACCESS_TTL: "900"
    JWT_REFRESH_TTL: "604800"
  httpApi:
    cors: true

package:
  individually: true
  patterns:
    - "!**"
    - "dist/**"
    - "node_modules/@node-rs/argon2-*/**"   # native binaries

functions:
  api:
    handler: dist/handler.handler
    events:
      - httpApi: "POST /auth/signup"
      - httpApi: "POST /auth/login"
      - httpApi: "POST /auth/logout"
      - httpApi: "POST /auth/refresh"

custom:
  localstack:
    stages: [local]
    host: http://localhost
    edgePort: 4566
    autostart: false
```

### Products-api `serverless.yml`
Same shape; routes:
```yaml
- httpApi: "GET /products"
- httpApi: "GET /products/{id}"
- httpApi: "POST /products"
- httpApi: "PATCH /products/{id}"
- httpApi: "DELETE /products/{id}"
```

### Root orchestrator
```yaml
# serverless-compose.yml at repo root
services:
  auth-api:
    path: apps/auth-api
  products-api:
    path: apps/products-api
```
Run with `serverless deploy --stage local` from root.

### LocalStack docker-compose entry
(Full compose in phase 08; the LocalStack service:)
```yaml
localstack:
  image: localstack/localstack:3.8
  ports: ["4566:4566"]
  environment:
    SERVICES: lambda,apigateway,iam,logs,cloudformation,sts
    DEFAULT_REGION: ap-southeast-1
    LAMBDA_EXECUTOR: docker
    DOCKER_HOST: unix:///var/run/docker.sock
  volumes:
    - "/var/run/docker.sock:/var/run/docker.sock"
    - "./infrastructure/localstack/init:/etc/localstack/init/ready.d"
```

### Migrations Lambda (one-shot)
- Add a third tiny app `apps/_migrate` whose handler runs `drizzle-orm/node-postgres/migrator` against `DATABASE_URL` then exits.
- Triggered manually via `serverless invoke --function migrate --stage dev`.
- For prod, run as a CodeBuild step or one-shot ECS task instead of a Lambda — documented.

### RDS connectivity (prod)
- Place Lambdas in a VPC with private subnets that have a route to RDS.
- Set `securityGroupIds` and `subnetIds` in `provider.vpc`.
- Recommend **RDS Proxy** to handle pool exhaustion. Connection string switches to the proxy endpoint; same `pg` driver works.

## Files to Create
- `apps/auth-api/serverless.yml`
- `apps/products-api/serverless.yml`
- `serverless-compose.yml` (root)
- `apps/_migrate/serverless.yml` + `apps/_migrate/src/handler.ts`
- `infrastructure/localstack/init/01-bootstrap.sh` — creates stub IAM, prints status
- `scripts/deploy-local.sh` — `serverless deploy --stage local`
- `scripts/deploy-aws.sh` — runs migrate Lambda then app stacks

## Implementation Steps
1. `pnpm add -Dw serverless serverless-localstack` (root devDep).
2. Author both `serverless.yml` files with HTTP API events.
3. Author root `serverless-compose.yml`.
4. Add npm scripts:
   - `"deploy:local": "serverless deploy --stage local"`
   - `"deploy:dev": "serverless deploy --stage dev --aws-profile lambder-dev"`
   - `"remove:local": "serverless remove --stage local"`
5. `pnpm build && pnpm deploy:local`. Hit endpoints via `awslocal apigatewayv2 get-apis` to find the URL.
6. Smoke-test full flow against LocalStack.
7. Document AWS deployment in `docs/deployment-aws.md` (RDS Proxy, SSM params, GitHub OIDC role).

## Todo List
- [ ] `serverless.yml` for both apps
- [ ] Root `serverless-compose.yml`
- [ ] LocalStack init script
- [ ] Migration Lambda
- [ ] `scripts/deploy-local.sh` + `scripts/deploy-aws.sh`
- [ ] End-to-end happy path against LocalStack passes
- [ ] Documentation for prod AWS deploy

## Success Criteria
- `pnpm deploy:local` deploys both stacks to LocalStack with no errors
- `curl http://localhost:4566/restapis/.../local/_user_request_/auth/signup` returns 201
- Cold start measured via `awslocal logs filter-log-events` < 500ms in LocalStack
- `pnpm deploy:dev` plan executes against real AWS without errors (with proper creds)

## Risk Assessment
| Risk | Mitigation |
|---|---|
| LocalStack Lambda doesn't reach host Postgres on Linux | Use `host.docker.internal:host-gateway` extra_hosts; fallback to compose network |
| API Gateway path differences (LocalStack vs AWS) | Tests target `/auth/...` paths; route normalization in tests |
| Serverless Framework v4 license/pricing | v4 requires login for commercial use over $2M revenue — note in `docs/`; OSS users unaffected |

## Security Considerations
- Production secrets via SSM Parameter Store; `${ssm:/lambder/dev/JWT_PRIVATE_KEY_PEM}` syntax.
- Lambda execution role: minimum perms (no `*` resource access).
- API Gateway throttling enabled in prod (e.g., 100 req/s burst, 50 rps steady).

## Next Steps
- Phase 08 finalizes Docker setup so the whole local stack can `docker compose up`.
