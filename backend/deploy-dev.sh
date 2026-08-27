#!/usr/bin/env bash
set -euo pipefail

cd /home/sniffer/scripts/deploy/nawabai20-dev

git fetch origin dev
git reset --hard origin/dev

docker compose build
docker compose up -d
docker image prune -f

# The container runs `alembic upgrade head` before gunicorn binds, so the app is
# not listening for several seconds after `up -d` returns. A single curl after
# `sleep 3` reported a healthy deploy as failed (connection refused in 3ms).
# Poll instead, and dump logs if it genuinely never comes up.
# Dev runs on 9001 (prod is 9000) so the two environments never collide.
HEALTH_URL="http://127.0.0.1:9001/api/v1/health/"
DEADLINE=$((SECONDS + 90))

until curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; do
  if (( SECONDS >= DEADLINE )); then
    echo "deploy FAILED: $HEALTH_URL never became healthy within 90s" >&2
    echo "--- container status ---" >&2
    docker compose ps >&2 || true
    echo "--- last 100 log lines ---" >&2
    docker compose logs --tail=100 >&2 || true
    exit 1
  fi
  sleep 3
done

echo "deploy OK"
