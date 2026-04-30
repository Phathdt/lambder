# Phase 08 — Docker Setup (compose + Lambda image)

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-07](./phase-07-localstack-serverless.md)

## Overview
- **Priority**: P0
- **Status**: Not started
- One `docker compose up` brings up Postgres, Redis, LocalStack, ready for `pnpm deploy:local`. Provide a `Dockerfile` per app for the Lambda **container image** deployment path (used as fallback when zip > 250 MB or for native deps that can't be packaged).

## Key Insights
- Default deployment path = **zip** (built by phase 06+07). Container image is a backup option, not the default.
- For dev, we don't run Lambdas in Docker — they run inside LocalStack which spawns its own Lambda containers.
- `bullseye-slim` base is too old for arm64 native modules; use `public.ecr.aws/lambda/nodejs:22` for the container image so it matches Lambda exactly.

## Requirements
- Functional
  - `docker compose up -d` starts: Postgres 16, Redis 7, LocalStack 3.x
  - Postgres seeded with `lambder` database, default user `lambder/lambder`
  - Volumes persisted for Postgres + Redis
  - Healthchecks defined for all three services
- Non-functional
  - Compose stack starts in < 30s on cold pulls
  - All ports exposed only on localhost (not 0.0.0.0)

## Architecture

### `docker-compose.yml`
```yaml
name: lambder-dev

services:
  postgres:
    image: postgres:16-alpine
    container_name: lambder-postgres
    ports: ["127.0.0.1:5432:5432"]
    environment:
      POSTGRES_DB: lambder
      POSTGRES_USER: lambder
      POSTGRES_PASSWORD: lambder
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lambder"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: lambder-redis
    ports: ["127.0.0.1:6379:6379"]
    volumes:
      - redis_data:/data
    command: ["redis-server", "--appendonly", "yes"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10

  localstack:
    image: localstack/localstack:3.8
    container_name: lambder-localstack
    ports: ["127.0.0.1:4566:4566"]
    environment:
      SERVICES: lambda,apigateway,iam,logs,cloudformation,sts,s3
      DEFAULT_REGION: ap-southeast-1
      LAMBDA_EXECUTOR: docker
      LAMBDA_DOCKER_NETWORK: lambder-dev_default
      LS_LOG: warn
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./infrastructure/localstack/init:/etc/localstack/init/ready.d
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
      interval: 5s
      retries: 20

volumes:
  pg_data:
  redis_data:
```

### Lambda container image (per app)
```dockerfile
# infrastructure/docker/lambda.dockerfile (parameterized via build arg)
ARG APP=auth-api
FROM node:22-bullseye AS builder
WORKDIR /build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/${APP} ./apps/${APP}
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter ${APP} build

FROM public.ecr.aws/lambda/nodejs:22
ARG APP
COPY --from=builder /build/apps/${APP}/dist ${LAMBDA_TASK_ROOT}/
COPY --from=builder /build/apps/${APP}/node_modules ${LAMBDA_TASK_ROOT}/node_modules
CMD ["handler.handler"]
```

Build:
```
docker build --build-arg APP=auth-api -f infrastructure/docker/lambda.dockerfile -t lambder-auth-api .
docker build --build-arg APP=products-api -f infrastructure/docker/lambda.dockerfile -t lambder-products-api .
```

### `.env.example`
```
DATABASE_URL=postgres://lambder:lambder@localhost:5432/lambder
REDIS_URL=redis://localhost:6379
JWT_PRIVATE_KEY_PEM=
JWT_PUBLIC_KEY_PEM=
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566
```

## Files to Create
- `docker-compose.yml`
- `infrastructure/docker/lambda.dockerfile`
- `infrastructure/docker/.dockerignore`
- `infrastructure/localstack/init/01-bootstrap.sh` (already in phase 07)
- `.env.example`

## Implementation Steps
1. Author `docker-compose.yml`.
2. Author parameterized `lambda.dockerfile`.
3. Author `.dockerignore` (exclude `node_modules`, `dist`, `.serverless`, `.turbo`, `.git`).
4. Add npm scripts:
   - `"compose:up": "docker compose up -d"`
   - `"compose:down": "docker compose down"`
   - `"compose:logs": "docker compose logs -f"`
   - `"docker:build:auth": "docker build --build-arg APP=auth-api -f infrastructure/docker/lambda.dockerfile -t lambder-auth-api ."`
5. Verify: `docker compose up -d && docker compose ps` — all three services healthy.
6. Verify: `pnpm db:migrate` runs against compose Postgres.

## Todo List
- [ ] `docker-compose.yml` with three services + healthchecks
- [ ] Parameterized Lambda Dockerfile
- [ ] `.dockerignore`
- [ ] Compose scripts in root `package.json`
- [ ] Validate full local stack boots and tests pass

## Success Criteria
- `docker compose up -d` reaches all-green health within 30s
- Postgres reachable at `localhost:5432`, Redis at `localhost:6379`, LocalStack at `localhost:4566`
- Container image build succeeds for both apps and `docker run` of the image starts the Lambda runtime emulator

## Risk Assessment
| Risk | Mitigation |
|---|---|
| LocalStack Lambda can't reach Postgres in compose | `LAMBDA_DOCKER_NETWORK` matches compose network; fallback `host.docker.internal` |
| Image size > 10GB Lambda limit | Use multi-stage build; copy only `dist` + production `node_modules` |
| Mac arm64 vs Lambda arm64 native deps | All compose images explicitly use `arm64` variants where available |

## Security Considerations
- All compose ports bound to `127.0.0.1` only.
- Default credentials for dev only; production uses RDS IAM auth or Secrets Manager.
- `.env` gitignored; only `.env.example` checked in.

## Next Steps
- Phase 09 adds tests + CI to validate everything stays green.
