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
postdeploy: npm run db:apply-schema && npm run db:upgrade-flow-configs && npm run db:seed-grids && npm run db:resync-rewards
```

The `postdeploy` hook is what keeps the database in step. It deliberately does **not** run `drizzle-kit push`: push has to disambiguate moved columns through an interactive prompt, and a deploy has no TTY. `scripts/db-apply-schema.ts` applies explicit, idempotent `IF NOT EXISTS` statements instead — so **a new column added to `drizzle.ts` must also be added there**. See [`database.md`](./database.md#migrations).

Since challenge 020, `db-apply-schema` also carries the data takeovers of the platform split. Each one is idempotent — a second pass writes nothing — and leaves the former columns in place, still readable by the previous release:

| Step | What it does |
|------|--------------|
| `challenges.flow_config` | Copies `workspace_mode`, `compute_enabled`, `cp_per_validation`, `required_validations` into the flow's configuration; splits `type = 'validation'` into `endpoint-validation` / `journey-validation`, and sets the qualification parameters (`reviewer_qualification`, `eligible_roles`, `expert_comment_qualification`) on configurations that lack them |
| `user_qualifications`, `qualification_changes` | Every `medical_pro` account becomes `contributor` with the `medical_pro` qualification, logged in both journals |
| `sandboxes.proposal_fields` | Copies `repo_url`, `model_url`, `dataset_urls`; `sandboxes.type` widens to `varchar(64)` (a flow key) |
| `integration_credentials` | Copies the GitHub, Kaggle, OpenAI, Slack and Scaleway connections of `app_settings` |
| `cron_runs` | The lock and last run of each job |
| `module_settings` | Copies `modules_meetings_enabled`, `modules_onboarding_enabled`, `digest_*` and `sandbox_*` of `app_settings` |
| `platform_events`, `event_deliveries` | The event outbox and each subscriber's cursor |
| `onboarding_quest_progress` | Copies the five booleans of `onboarding_progress`, one row per completed quest |

`scripts/db-upgrade-flow-configs.ts` records the upgrades of `challenges.flow_config` to the version each installed flow declares (the application already upgrades an older configuration in memory when it reads it). `scripts/db-seed-grids.ts` then inserts the evaluation grids the installed flows need (`code`, `model`, `dataset`, listed in `src/distribution/mytwin.grids.ts`) when no grid carries their slug yet — the core has no built-in grid, and an evaluation without its grid fails. `scripts/db-resync-rewards.ts` finally rebuilds the derived caches (`contributions.reward`, `challenges.completion`).

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

Required for full mode (`OPENAI_API_KEY` and `GITHUB_TOKEN` only as fallbacks of the admin connections):
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

One endpoint is hit **every minute**, secured by `Authorization: Bearer $CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/tick
```

The tick runs every job whose schedule has come due since its last start (UTC cron expressions), one at a time. Each job is taken through a lock in `cron_runs` (last start, last status, last error), so two ticks never run the same job twice, and a failing job does not stop the others. Jobs are declared by their owner:

| Job | Owner | Schedule | Purpose |
|-----|-------|----------|---------|
| `meetings.check` | module meetings | every minute | Detect completed meetings and trigger analysis |
| `slack-signals.detect` | extension slack-signals | daily, 06:00 UTC | Detect Slack contribution signals (see [`slack-signals.md`](./slack-signals.md)) |
| `compute.provisioning` | extension compute | every minute | Flip GPU instances to `ready` once Scaleway answers (see [`compute-power.md`](./compute-power.md)) |
| `compute.expiration` | extension compute | every minute | Terminate GPU instances past their 24h window |
| `digest.generate` | module digest | daily, 05:00 UTC | Generate an activity digest when one is due (see [`digest.md`](./digest.md)) |
| `core.refresh-tokens.cleanup` | core | daily, 05:00 UTC | Delete expired refresh tokens |
| `sandbox.ip-hashes.purge` | module sandbox | daily, 05:00 UTC | Erase star IP hashes older than 30 days |
| `endpoint-validation.evidence.purge` | flow endpoint-validation | daily, 05:00 UTC | Erase validation evidence 12 months after the challenge closed |

A job with no row in `cron_runs` only catches an occurrence from the last 5 minutes: deploying a daily job at 14:00 runs it the next day, not immediately.

The tick checks the secret with `isCronAuthorized` (`apps/leaderboard-client/src/lib/server/cronAuth.ts`). A job owned by a disabled module is recorded as `skipped`. Two core jobs, `core.events.distribute` and `core.events.purge`, deliver the event outbox to its subscribers and purge events older than 30 days.

**Scalingo.** The Scalingo Scheduler needs a single entry, `* * * * *`, calling `/api/cron/tick`. Switch it on the first deploy of challenge 020. The five former endpoints (`/api/cron/check-meetings`, `slack-signals`, `compute-provisioning`, `compute-expiration`, `digest`) are thin wrappers (`cronJobRoute`, `apps/leaderboard-client/src/lib/server/cronJobRoute.ts`) that run their job under the same lock, so an old scheduler entry cannot double a run while both coexist. They are removed after the switch (see [Post-deploy steps](#post-deploy-steps-l7-not-run-on-the-branch)).

**Vercel.** `vercel.json` still lists the five former endpoints; whether a Vercel deployment exists has to be checked before removing it.

---

## Observability

The app is instrumented with OpenTelemetry. Traces are exported to Grafana Cloud if configured:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-eu-west-2.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-instance_id:api_token>
OTEL_SERVICE_NAME=leaderboard-api
```

These are optional — the app runs fine without them.

## Integrations

Admin connections (GitHub, Kaggle, Slack, OpenAI, Scaleway) are stored in `integration_credentials`, encrypted with `GITHUB_TOKEN_ENCRYPTION_KEY`. `db:apply-schema` copies the existing `app_settings` connections on the first deploy; nothing has to be reconnected.

The routes are `/api/integrations/[key]/{connection,status,authorize,callback,extras/[action]}` (see [`admin-settings.md`](./admin-settings.md)).

**GitHub OAuth callback.** The GitHub OAuth app may keep `GITHUB_OAUTH_REDIRECT_URI=<origin>/api/github-oauth/callback`: that route is kept as a compatibility alias of `/api/integrations/github/callback`. To move to the new URL, first add `<origin>/api/integrations/github/callback` to the OAuth app's callback URLs on GitHub, then update `GITHUB_OAUTH_REDIRECT_URI` on Scalingo. Changing the variable first breaks the connection flow.

**Branch provisioning.** The GitHub workspace provider is always registered and reads the token of the GitHub connection at each call (`getGithubToken()`, `packages/config/githubToken.ts`). While no account is connected, it falls back to `GITHUB_TOKEN`; without either, provisioning answers "unavailable" instead of failing the join.

---

## Post-deploy steps (L7, not run on the branch)

Challenge 020 keeps every former column, route and fallback so that the previous release keeps working during a deploy and a rollback stays possible. Once production has run the new release and the check of each step passes, remove them in this order.

### 1. Former columns

Take a backup first. Check that the takeovers are complete — each query must return `0`:

```sql
-- flow_config carries what the columns held
SELECT count(*) FROM challenges WHERE flow_config IS NULL;
-- no account left on the former role
SELECT count(*) FROM users WHERE role = 'medical_pro';
-- proposals copied
SELECT count(*) FROM sandboxes WHERE proposal_fields -> 'repo_url' IS DISTINCT FROM to_jsonb(repo_url);
-- connections copied
SELECT count(*) FROM app_settings s WHERE s.github_token_enc IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM integration_credentials WHERE key = 'github');
-- module states copied
SELECT count(*) FROM app_settings WHERE NOT EXISTS (SELECT 1 FROM module_settings WHERE key = 'sandbox');
```

Then drop, in `scripts/db-apply-schema.ts` (with `IF EXISTS`), `drizzle.ts` and the takeover steps that read them:

- `challenges`: `workspace_mode`, `compute_enabled`, `cp_per_validation`, `required_validations`;
- `app_settings`: `github_token_enc`, `github_token_iv`, `github_org`, `github_connected_at`, `github_connected_by`, `kaggle_username`, `kaggle_key_enc`, `kaggle_key_iv`, `kaggle_connected_at`, `kaggle_connected_by`, `openai_key_enc`, `openai_key_iv`, `openai_connected_at`, `openai_connected_by`, `slack_token_enc`, `slack_token_iv`, `slack_team_name`, `slack_connected_at`, `slack_connected_by`, `scaleway_secret_key_enc`, `scaleway_secret_key_iv`, `scaleway_project_id`, `scaleway_zone`, `scaleway_connected_at`, `scaleway_connected_by`, `scaleway_disconnect_requested_at`, `modules_meetings_enabled`, `modules_onboarding_enabled`, `digest_enabled`, `digest_frequency_days`, `sandbox_star_tiers`, `sandbox_promotion_bonus_cp`;
- `sandboxes`: `repo_url`, `model_url`, `dataset_urls` (with `packages/database-service/domain/legacyProposalFields.ts`);
- the `onboarding_progress` table, with the rollback row `OnboardingProgressRepository` still inserts for a new user and its merge in `accountMerge.repo.ts` (every read already goes through `onboarding_quest_progress`).

### 2. `medical_pro` in the proxy

`apps/leaderboard-client/src/proxy.ts` still accepts the `medical_pro` role, for access tokens issued before the takeover. Remove it **at least 7 days after** the first deploy of challenge 020, once no session can still carry the former role. Check: `SELECT count(*) FROM users WHERE role = 'medical_pro'` returns `0`.

### 3. `GITHUB_TOKEN` fallback

Check that a GitHub account is connected (`SELECT connected_at, meta FROM integration_credentials WHERE key = 'github'`) and that joining a code challenge provisions a branch. Then remove the fallback from `getGithubToken()` and `GITHUB_TOKEN` from `packages/config/index.ts` and the Scalingo environment.

### 4. Cron wrappers

Check that the Scalingo Scheduler has a single `/api/cron/tick` entry and that `SELECT job_key, last_started_at, last_status FROM cron_runs` shows every job running from the tick. Then delete `apps/leaderboard-client/src/app/api/cron/{check-meetings,slack-signals,compute-provisioning,compute-expiration,digest}` and `cronJobRoute`.

### 5. `vercel.json`

Check in the Vercel dashboard whether a project deploys this repository. If none does, delete `vercel.json`; otherwise replace its five entries with a single `* * * * *` entry on `/api/cron/tick`.

The `/api/github-oauth/callback` alias goes once `GITHUB_OAUTH_REDIRECT_URI` points at `/api/integrations/github/callback`.
