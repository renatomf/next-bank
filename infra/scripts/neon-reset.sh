#!/bin/sh
# Restores the demo branch from its parent "clean" through the Neon API and
# waits for it (DEMO-02; week 8 plan, D5). Needs NEON_API_KEY, NEON_PROJECT_ID,
# NEON_DEMO_BRANCH_ID and NEON_CLEAN_BRANCH_ID; the key is never printed.
set -eu
project="https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID"

neon() {
  curl -fsS --max-time 60 -H "authorization: Bearer $NEON_API_KEY" \
    -H 'accept: application/json' "$@"
}

operations=$(neon -X POST "$project/branches/$NEON_DEMO_BRANCH_ID/restore" \
  -H 'content-type: application/json' \
  -d "{\"source_branch_id\":\"$NEON_CLEAN_BRANCH_ID\"}" | jq -r '.operations[].id')

for operation in $operations; do
  for _ in $(seq 1 60); do
    status=$(neon "$project/operations/$operation" | jq -r '.operation.status')
    case "$status" in
      finished) break ;;
      failed | error | cancelled)
        echo "Neon operation $operation ended as $status" >&2
        exit 1
        ;;
    esac
    sleep 5
  done
  [ "$status" = finished ] || { echo "Neon operation $operation timed out" >&2; exit 1; }
done
echo "Demo branch restored from clean."
