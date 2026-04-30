#!/usr/bin/env bash
set -euo pipefail

# Hits LocalStack-deployed APIs end-to-end. Run after `pnpm deploy:local`.
HOST="${HOST:-http://localhost:4566}"
EMAIL="smoke+$(date +%s)@example.com"
PASSWORD='SmokeTest123!@#'

echo "[smoke] discover api ids"
AUTH_API=$(awslocal apigatewayv2 get-apis --query 'Items[?Name==`local-lambder-auth-api`].ApiId' --output text)
PRODUCTS_API=$(awslocal apigatewayv2 get-apis --query 'Items[?Name==`local-lambder-products-api`].ApiId' --output text)

AUTH_URL="${HOST}/restapis/${AUTH_API}/local/_user_request_"
PRODUCTS_URL="${HOST}/restapis/${PRODUCTS_API}/local/_user_request_"

echo "[smoke] signup"
curl -fsS -X POST "${AUTH_URL}/auth/signup" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"

echo "[smoke] login"
TOKENS=$(curl -fsS -X POST "${AUTH_URL}/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
ACCESS=$(echo "$TOKENS" | jq -r .accessToken)

echo "[smoke] create product"
PRODUCT=$(curl -fsS -X POST "${PRODUCTS_URL}/products" \
  -H "authorization: Bearer ${ACCESS}" \
  -H 'content-type: application/json' \
  -d '{"name":"Smoke","price":"9.99"}')
PID=$(echo "$PRODUCT" | jq -r .id)

echo "[smoke] get product"
curl -fsS "${PRODUCTS_URL}/products/${PID}" >/dev/null

echo "[smoke] delete product"
curl -fsS -X DELETE "${PRODUCTS_URL}/products/${PID}" \
  -H "authorization: Bearer ${ACCESS}"

echo "[smoke] logout"
curl -fsS -X POST "${AUTH_URL}/auth/logout" \
  -H "authorization: Bearer ${ACCESS}"

echo "[smoke] OK"
