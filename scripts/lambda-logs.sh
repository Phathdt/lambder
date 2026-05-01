#!/usr/bin/env bash
# Tail logs from a LocalStack Lambda runtime container.
# Usage: ./scripts/lambda-logs.sh auth-api    [-f]
set -e

APP="${1:?Usage: lambda-logs.sh <auth-api|products-api> [-f]}"
FOLLOW="${2:-}"
PRETTY="${PRETTY:-1}"

CONTAINER=$(docker ps --filter "name=lambder-localstack-lambda-lambder-${APP}" \
  --format '{{.Names}}' | head -1)

if [[ -z "$CONTAINER" ]]; then
  echo "no running container for lambder-${APP}; invoke the function once first" >&2
  exit 1
fi

if [[ "$PRETTY" == "1" ]] && command -v pino-pretty >/dev/null 2>&1; then
  if [[ "$FOLLOW" == "-f" ]]; then
    docker logs -f "$CONTAINER" 2>&1 | pino-pretty
  else
    docker logs "$CONTAINER" 2>&1 | pino-pretty
  fi
else
  if [[ "$FOLLOW" == "-f" ]]; then
    docker logs -f "$CONTAINER"
  else
    docker logs "$CONTAINER"
  fi
fi
