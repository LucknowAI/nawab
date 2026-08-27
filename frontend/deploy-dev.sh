#!/usr/bin/env bash
set -euo pipefail

cd /home/sniffer/scripts/deploy/nawabaifrontend-dev

git fetch origin vercel-dev
git reset --hard origin/vercel-dev

docker compose build
docker compose up -d
docker image prune -f

# Poll instead of a fixed sleep - Next's standalone server is usually up in
# a second or two, but a slow build box shouldn't fail the deploy outright.
HEALTH_URL="http://127.0.0.1:3010/"
DEADLINE=$((SECONDS + 60))

until curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; do
  if (( SECONDS >= DEADLINE )); then
    echo "deploy FAILED: $HEALTH_URL never became healthy within 60s" >&2
    echo "--- container status ---" >&2
    docker compose ps >&2 || true
    echo "--- last 100 log lines ---" >&2
    docker compose logs --tail=100 >&2 || true
    exit 1
  fi
  sleep 2
done

echo "deploy OK"
