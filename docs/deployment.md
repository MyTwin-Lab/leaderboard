# Deployment

The app is a single Next.js process. Three deployment shapes are in use:

- **PM2 on a VPS** — the setup this document describes in detail.
- **Scalingo** — driven by `Procfile` (see [Deploying on Scalingo](#deploying-on-scalingo)).
- **Vercel** — `vercel.json` declares the cron schedules.

---

## Prerequisites

- Node.js 18+ installed on the server
- PM2 installed globally: `npm install -g pm2`
- PostgreSQL running and accessible
- A `.env` file at the repo root with all required variables set

---

## Optional integrations

The evaluator, the connectors and the sync meetings read their credentials when they are called — from the admin connections, or from the environment as a fallback. A missing key makes the feature that needs it unavailable; it does not break `next build`. There is therefore a single production mode.

---

## Deploy steps

From the repo root on the server:

```bash
npm run prod
```

This runs:
1. `npm install` (installs dependencies)
2. `next build` (builds the Next.js app)
3. `pm2 start` (starts the process via PM2)

**Default port:** `3014`
Override with: `PORT=8080 npm run prod:full`

**PM2 app name:** `leaderboard-client`

---

## PM2 management commands

```bash
npm run prod:status    # Check if the process is running
npm run prod:logs      # Stream logs
npm run prod:restart   # Restart the app (after a code update)
npm run prod:stop      # Stop the process
npm run prod:delete    # Remove the process from PM2
```

---

## Updating the app

```bash
git pull
npm run prod:restart   # or npm run prod to rebuild
```

If you changed the database schema:

```bash
npm run db:push        # Apply schema changes before restarting
npm run prod:restart
```

---

## Nginx reverse proxy

Point your domain to the VPS, then proxy to the local Next.js process:

```nginx
server {
    server_name lab.my-twin.io;

    location / {
        proxy_pass http://127.0.0.1:3014;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable HTTPS with Certbot: `certbot --nginx -d lab.my-twin.io`

---

## Deploying on Scalingo

`Procfile` declares two processes:

```
web: cd apps/leaderboard-client && npm run start -- -p $PORT
postdeploy: npm run db:apply-schema && npm run db:seed-grids && npm run db:resync-rewards
```

The `postdeploy` hook is what keeps the database in step. It deliberately does **not** run `drizzle-kit push`: push has to disambiguate moved columns through an interactive prompt, and a deploy has no TTY. `scripts/db-apply-schema.ts` applies explicit, idempotent `IF NOT EXISTS` statements instead — so **a new column added to `drizzle.ts` must also be added there**. See [`database.md`](./database.md#migrations).

`scripts/db-seed-grids.ts` then inserts the evaluation grids the installed flows need (`code`, `model`, `dataset`, listed in `src/distribution/mytwin.grids.ts`) when no grid carries their slug yet — the core has no built-in grid, and an evaluation without its grid fails. `scripts/db-resync-rewards.ts` finally rebuilds the derived caches (`contributions.reward`, `challenges.completion`).

**The postdeploy runs while the previous release still serves traffic** — Scalingo only switches routing once it succeeds, and keeps the old release if it fails. Schema changes must therefore keep the old code working. The slug columns are the case in point: they are added nullable, backfilled under a write lock and set `NOT NULL` in one transaction per table, at the very end of `db-apply-schema`. Between that `NOT NULL` and the routing switch (seconds), the old release cannot create a challenge or a sandbox. If the postdeploy fails *after* it, the old release stays up in that state — roll back with `ALTER TABLE challenges ALTER COLUMN slug DROP NOT NULL` (and the same on `sandboxes`) while you fix the deploy. Before the first deploy of a data migration like this one, take a manual backup from the Scalingo dashboard, and preview what will be written with `npm run db:preview-slugs` through `scalingo db-tunnel`.

---

## Environment variables for production

The `.env` at the repo root is read by both Drizzle and the Next.js build. The `apps/leaderboard-client/.env.local` should also be set (or symlinked):

```bash
cp .env apps/leaderboard-client/.env.local
```

Required in production:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-32+-character-secret
NODE_ENV=production
```

Required for full mode:
```env
OPENAI_API_KEY=...
GITHUB_TOKEN=...
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY=...
GOOGLE_WORKSPACE_ADMIN_EMAIL=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=...
CRON_SECRET=...
```

Optional, only if you want the in-app GitHub OAuth connection, Kaggle-backed ML challenges, or Slack contribution signals (see [`admin-settings.md`](./admin-settings.md)):
```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_OAUTH_REDIRECT_URI=...
GITHUB_TOKEN_ENCRYPTION_KEY=...
KAGGLE_USERNAME=...
KAGGLE_KEY=...
SLACK_BOT_TOKEN=...
```

GPU compute has no env fallback at all — Scaleway credentials are only ever set from the admin UI (see [`compute-power.md`](./compute-power.md)).

---

## Cron jobs

Five endpoints must be hit on a schedule, all secured by `Authorization: Bearer $CRON_SECRET`:

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/check-meetings` | every minute | Detect completed meetings and trigger analysis |
| `/api/cron/slack-signals` | daily, 06:00 UTC | Detect Slack contribution signals (see [`slack-signals.md`](./slack-signals.md)) |
| `/api/cron/compute-provisioning` | every minute | Flip GPU instances to `ready` once Scaleway answers (see [`compute-power.md`](./compute-power.md)) |
| `/api/cron/compute-expiration` | every minute | Terminate GPU instances past their 24h window |
| `/api/cron/digest` | daily, 05:00 UTC | Generate an activity digest when one is due (see [`digest.md`](./digest.md)) |

On **Vercel**, `vercel.json` declares all five crons and nothing else is needed. On **Scalingo / PM2**, there is no built-in scheduler: use the Scalingo Scheduler addon, a system crontab, or an external service (e.g. cron-job.org) to `curl` the endpoints:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/slack-signals
```

---

## Observability

The app is instrumented with OpenTelemetry. Traces are exported to Grafana Cloud if configured:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-eu-west-2.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-instance_id:api_token>
OTEL_SERVICE_NAME=leaderboard-api
```

These are optional — the app runs fine without them.
