#!/usr/bin/env bash
# LocalStack init script — runs once when LocalStack is ready.
set -euo pipefail
echo "[lambder] LocalStack bootstrap complete"
awslocal --version || true
