#!/bin/sh
# Waits until the published API answers its health check with the commit just
# deployed (week 8 plan, task 3b). Usage: wait-for-release.sh <api-url> <commit>
set -eu
api_url="$1"
release="$2"
# Render's free plan builds and starts in a few minutes; 10 is plenty.
for _ in $(seq 1 60); do
  running=$(curl -fsS --max-time 30 "$api_url/health" 2>/dev/null | jq -r '.release // ""' || true)
  if [ "$running" = "$release" ]; then
    echo "Release $release is live."
    exit 0
  fi
  sleep 10
done
echo "Release $release did not go live; running: ${running:-none}" >&2
exit 1
