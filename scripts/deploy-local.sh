#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[deploy:local] building all apps"
pnpm turbo run build --filter=auth-api --filter=products-api
echo "[deploy:local] deploying to LocalStack"
pnpm exec serverless deploy --stage local
