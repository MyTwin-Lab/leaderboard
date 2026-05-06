# Deployment

The app is deployed as a single Next.js process managed by **PM2** on a VPS.

---

## Prerequisites

- Node.js 18+ installed on the server
- PM2 installed globally: `npm install -g pm2`
- PostgreSQL running and accessible
- A `.env` file at the repo root with all required variables set

---

## Two production modes

The optional packages (evaluator, connectors, sync meetings) require API keys. If those keys are not available, the build will fail. To handle this, there are two production modes:

| Mode | Command | When to use |
|------|---------|-------------|
| **Full** | `npm run prod:full` | You have all API keys (`OPENAI_API_KEY`, Google credentials, etc.) |
| **Minimal** | `npm run prod:min` | You only need the UI + database. No AI, no connectors. |

`prod:min` injects placeholder values for optional env vars so `next build` doesn't crash, then runs the app without those features active.

---

## Deploy steps

From the repo root on the server:

```bash
# Full mode (all features enabled)
npm run prod:full

# Or minimal mode (UI + DB only)
npm run prod:min
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
npm run prod:restart   # or prod:full / prod:min to rebuild
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

---

## Observability

The app is instrumented with OpenTelemetry. Traces are exported to Grafana Cloud if configured:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-eu-west-2.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-instance_id:api_token>
OTEL_SERVICE_NAME=leaderboard-api
```

These are optional — the app runs fine without them.
