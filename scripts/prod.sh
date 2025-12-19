#!/usr/bin/env bash
set -euo pipefail

# Production build + run (PM2) for the Next.js app.
#
# Two supported modes:
# - full: enables all features (connectors/evaluator) -> requires real API keys in .env
# - min : minimal start (client + DB). Sets safe placeholder API keys so `next build` doesn't fail.
#
# Run from repo root:
#   npm run prod         # full (default)
#   npm run prod:full
#   npm run prod:min

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="leaderboard-client"
DEFAULT_PORT="3014"

MODE="${1:-full}"
case "$MODE" in
  full|min|minimal)
    ;;
  *)
    echo "ERROR: Unknown mode: $MODE"
    echo "Usage: bash ./scripts/prod.sh [full|min]"
    exit 1
    ;;
esac

if [[ -f "$ROOT_DIR/.env" ]]; then
  # Export all vars from .env into the current shell for build + PM2.
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env" || echo "WARN: Could not source $ROOT_DIR/.env (permissions?). Continuing with current environment."
  set +a
else
  echo "WARN: $ROOT_DIR/.env not found. DATABASE_URL/JWT_SECRET may be missing."
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-$DEFAULT_PORT}"

if [[ "$MODE" == "min" || "$MODE" == "minimal" ]]; then
  # IMPORTANT:
  # Next.js `next build` may import API routes that import evaluator/connectors code.
  # Some optional integrations instantiate SDK clients at import time and crash if keys are missing.
  # In "minimal" mode we set placeholders so the build/start works without enabling those features.
  export OPENAI_API_KEY="${OPENAI_API_KEY:-__disabled__}"
  export GITHUB_TOKEN="${GITHUB_TOKEN:-__disabled__}"
  export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-__disabled__}"
  export GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-__disabled__}"
  export GOOGLE_REFRESH_TOKEN="${GOOGLE_REFRESH_TOKEN:-__disabled__}"
  export GOOGLE_REDIRECT_URI="${GOOGLE_REDIRECT_URI:-http://localhost/disabled}"
  export GOOGLE_FOLDER_ID="${GOOGLE_FOLDER_ID:-__disabled__}"
fi

echo "Production mode: $MODE"
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


