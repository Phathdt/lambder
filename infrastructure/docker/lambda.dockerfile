# Multi-stage Lambda container image. Parameterized via APP build arg.
# Usage:
#   docker build --build-arg APP=auth-api -f infrastructure/docker/lambda.dockerfile -t lambder-auth-api .
#   docker build --build-arg APP=products-api -f infrastructure/docker/lambda.dockerfile -t lambder-products-api .

ARG APP=auth-api

FROM node:22-bullseye AS builder
ARG APP
WORKDIR /build

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/${APP} ./apps/${APP}

RUN pnpm install --frozen-lockfile
RUN pnpm --filter ${APP} build

FROM public.ecr.aws/lambda/nodejs:22
ARG APP
COPY --from=builder /build/apps/${APP}/dist/ ${LAMBDA_TASK_ROOT}/
# Native binaries for argon2 (pre-built per arch by @node-rs/argon2)
COPY --from=builder /build/node_modules/@node-rs ${LAMBDA_TASK_ROOT}/node_modules/@node-rs

CMD ["main.handler"]
