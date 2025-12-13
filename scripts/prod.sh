#!/usr/bin/env bash
set -euo pipefail

# Production build + run (PM2) for the Next.js app.
# Run from repo root:
#   npm run prod

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="leaderboard-client"
DEFAULT_PORT="3014"

if [[ -f "$ROOT_DIR/.env" ]]; then
  # Export all vars from .env into the current shell for build + PM2.
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
else
  echo "WARN: $ROOT_DIR/.env not found. DATABASE_URL/JWT_SECRET may be missing."
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-$DEFAULT_PORT}"

echo "Building Next.js app (apps/leaderboard-client)..."
pushd "$ROOT_DIR/apps/leaderboard-client" >/dev/null
npm run build
popd >/dev/null

echo "Starting (or reloading) PM2 process: $APP_NAME on port $PORT"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 is not installed or not in PATH."
  echo "Install it globally on the server, e.g.: npm i -g pm2"
  exit 1
fi

pm2 startOrReload "$ROOT_DIR/ecosystem.config.cjs" --only "$APP_NAME" --update-env

echo "PM2 status:"
pm2 status --no-color

echo ""
echo "Done."
echo "Tips:"
echo "  - Logs:   npm run prod:logs"
echo "  - Stop:   npm run prod:stop"
echo "  - Restart npm run prod:restart"


