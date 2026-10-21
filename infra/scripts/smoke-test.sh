#!/bin/sh
# After a deploy or a reset: the API is healthy and the demo account Ana signs
# in. Her credentials are public on purpose (README; seed-demo.ts), and the
# session opened here is ended at once. Usage: smoke-test.sh <api-url>
set -eu
api_url="$1"

curl -fsS --max-time 60 "$api_url/health" > /dev/null

# The login counters must see the real client behind the proxies (API-14).
sh "$(dirname "$0")/check-client-ip.sh" "$api_url"

tokens=$(curl -fsS --max-time 30 -X POST "$api_url/v1/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"ana.demo@example.com","password":"demo-ana-next-bank"}')
access_token=$(printf '%s' "$tokens" | jq -r '.accessToken')
echo "::add-mask::$access_token"

curl -fsS --max-time 30 "$api_url/v1/me/account" \
  -H "authorization: Bearer $access_token" > /dev/null
curl -fsS --max-time 30 -X POST "$api_url/v1/auth/logout" \
  -H "authorization: Bearer $access_token" > /dev/null
echo "Smoke test passed."
