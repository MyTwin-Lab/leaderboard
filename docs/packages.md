# Packages

This monorepo is organized into one app and several packages. Packages are shared libraries — they are not deployed independently, they are imported by the app or by each other.

---

## `apps/leaderboard-client`

**Type:** Next.js 16 application (App Router)
**Role:** The single deployable artifact. Serves the UI and handles all server-side logic via Route Handlers.

Key responsibilities:
- Renders all pages: leaderboard, challenges, contributor profiles, admin panel, onboarding
- Implements all API endpoints under `src/app/api/`
- Handles authentication (Google OAuth login, JWT cookies, middleware protection)
- Integrates with all packages at runtime

---

## `packages/config`

**Required by:** everything
**Purpose:** Validates all environment variables at startup using Zod. If a required variable is missing or malformed, the process fails fast with a clear error message.

Variables it validates:
- `DATABASE_URL` — required
- `JWT_SECRET` — required, must be 32+ characters
- `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` — optional (defaults: `15m` / `7d`)
- `OPENAI_API_KEY` — required in full prod mode
- `GITHUB_TOKEN` — optional (static fallback token)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_OAUTH_REDIRECT_URI` / `GITHUB_TOKEN_ENCRYPTION_KEY` — optional (in-app GitHub OAuth connection, see [`github-setup.md`](./github-setup.md))
- `KAGGLE_USERNAME` / `KAGGLE_KEY` — optional (fallback Kaggle credentials, see [`admin-settings.md`](./admin-settings.md))
- `SLACK_BOT_TOKEN` — optional (fallback Slack bot token, see [`admin-settings.md`](./admin-settings.md))
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT_URI` — required (used for login via Google OAuth)
- Other `GOOGLE_*` — Google Workspace / Drive credentials (optional, for sync meetings and connectors)
- `CRON_SECRET` — optional (secures the meeting-polling cron endpoint)
- `OTEL_*` — observability config (optional)
- `VALIDATION_ALLOW_PRIVATE_ENDPOINTS` — optional, **local dev only** (lets the validation-challenge SSRF guard accept localhost/private endpoints — see [`validation-challenges.md`](./validation-challenges.md))

> Scaleway has **no** env fallback — GPU compute credentials only ever come from the admin-connected account (see [`compute-power.md`](./compute-power.md)).

**Key files:** `packages/config/index.ts`, plus one module per encrypted credential: `githubToken.ts`, `kaggleCredentials.ts`, `slackCredentials.ts`, `openaiCredentials.ts`, `scalewayCredentials.ts`

---

## `packages/database-service`

**Required by:** `leaderboard-client`, `services`
**Purpose:** PostgreSQL schema definition + typed repositories for all database access. This is the only package that talks to the database directly.

What it provides:
- **Schema** (`db/drizzle.ts`) — all table definitions, relations, and enums using Drizzle ORM
- **Mappers** (`db/mappers.ts`) — converts raw DB rows to typed domain entities
- **Domain types** (`domain/entities.ts`) — TypeScript types for all entities
- **Repositories** (`repositories/`) — one repository per domain area, with typed CRUD and query methods

Repositories available:
`accountMerge`, `appSettings`, `caseClaim`, `challenge`, `challengeDocument`, `challengeRepos`, `challengeSignal`, `challengeSlackConfig`, `challengeTeam`, `computeRequest`, `contribution`, `evaluationGrids`, `evaluationRunContributions`, `evaluationRuns`, `meetingAnalysis`, `meetingParticipant`, `onboardingProgress`, `project`, `referenceCase`, `refreshToken`, `repo`, `rewardEntry`, `syncMeeting`, `task`, `user`, `validationAttempt`, `validationTarget`

**Key file:** `packages/database-service/db/drizzle.ts`

---

## `packages/evaluator`

**Optional** — requires `OPENAI_API_KEY`
**Purpose:** AI scoring engine for code challenges, plus the pure scoring functions behind ML challenge rewards.

The evaluator exposes one active agent:
- **Evaluate** (`openai/evaluate.agent.ts`) — scores a contribution against a grid (0–9 per criterion, `globalScore` a weighted sum on that same ~0–9 scale since the grid's weights sum to ~1)

Scoring grids (in `grids/`):
- `code.grid.ts` — technical quality, architecture, security, maintainability, documentation, impact. Used by the code challenge project evaluation **and** by the ML `model code` and `API packaging` steps.
- `dataset.grid.ts` — ML `dataset` submissions
- `model.grid.ts` — kept but currently unused (see [`ml-rewards.md`](./ml-rewards.md) — Kaggle models are scored from their reported metric, not by an agent)

Each agent call is wrapped with 3-retry logic (1-second backoff).

`code-reward.ts` computes a code challenge's live award (`computeCodeAward()` — fixed + quality, positive delta, pool-clamped; see [`challenges-and-tasks.md`](./challenges-and-tasks.md#rewards)). `ml-reward.ts` computes live, absolute point awards for ML challenges (caps, metric normalization, lead bonus, reuse deductions) — see [`ml-rewards.md`](./ml-rewards.md). Neither splits a pool at challenge close any more.

> The package also contains `openai/identify.agent.ts` and `openai/merge.agent.ts` from the old challenge-level pipeline — these are **no longer used**.

**Key file:** `packages/evaluator/evaluator.ts` (`OpenAIAgentEvaluator` class)

---

## `packages/connectors`

**Optional** — requires GitHub/Kaggle/Google credentials
**Purpose:** Fetches raw content from external data sources. All connectors implement a common `ExternalConnector` interface.

Available connectors:
- **GitHub** — fetch commits, file contents, repository metadata, and live activity (commits/PRs/reviews/branches) via Octokit
- **Kaggle** — fetch dataset metadata and versioned model metrics (AUC/F1/accuracy) via the Kaggle API
- **Google Drive** — list and read files from a Drive folder via OAuth2
- **Slack** — fetch channel messages (with a `ts` cursor), resolve author profiles/emails, and list public channels via the Slack Web API — see [`slack-signals.md`](./slack-signals.md)

Interface methods: `connect()`, `testConnection()`, `fetchItems()`, `fetchItemContent()`, `fetchRepoActivity()` (GitHub/Kaggle only), `disconnect()`

GitHub, Kaggle and Slack credentials can come from an admin-connected account (encrypted, stored in `app_settings`) or fall back to `.env` — see [`admin-settings.md`](./admin-settings.md).

**Key files:** `packages/connectors/implementation/` (`Github.connector.ts`, `Kaggle.connector.ts`, `GD.connector.ts`, `Slack.connector.ts`), `packages/connectors/registry.ts`, `packages/connectors/interfaces.ts`

---

## `packages/services`

**Optional** — orchestrates the optional packages
**Purpose:** Business logic and orchestration that combines database access, connectors, and the evaluator. The app calls these services from Route Handlers rather than calling the lower-level packages directly.

Key services:
- **`challenge/code-rewards.service.ts`** (`CodeRewardsService`) — live evaluation of a code challenge's personal boards: preconditions (board complete, workspace ready, no run already in progress) → resolve the contributor's branch/repo → snapshot → agent score → ledger award, project-scoped rather than per-task — see [`evaluation.md`](./evaluation.md)
- **`challenge/challenge.service.ts`** — challenge CRUD and state transitions
- **`challenge/ml-rewards.service.ts`** — orchestrates ML challenge scoring and the point ledger; **`challenge/artifactUrl.ts`** and **`challenge/lineage.ts`** support reuse detection — see [`ml-rewards.md`](./ml-rewards.md)
- **`challenge/snapshot.service.ts`** — builds the aggregated code snapshot handed to the evaluator
- **`challenge/validation-challenge.service.ts`** + **`challenge/reference-case.service.ts`** + **`challenge/endpoint-proxy.ts`** + **`challenge/ssrf-guard.ts`** — the validation challenge flow — see [`validation-challenges.md`](./validation-challenges.md)
- **`compute/`** — GPU compute requests: `compute-request.service.ts` plus the two cron entry points — see [`compute-power.md`](./compute-power.md)
- **`google-workspace/`** — `google-auth.service.ts` (OAuth2 tokens, used for login too), `google-calendar.service.ts`, `google-meet.service.ts`
- **`evaluation-grid.service.ts`** / **`database-grid-provider.ts`** — evaluation grids stored in the DB
- **`sync-meeting/`** — full sync meeting lifecycle (creation → polling → ingestion → analysis)
- **`slack/`** — daily Slack signal ingestion: `slack-signals.service.ts` (per-challenge cursor, author resolution, LLM detection, ledger writes) and `cron-slack-signals.ts` (loops over configured challenges) — see [`slack-signals.md`](./slack-signals.md)
- **`run-logger.ts`** — shared evaluation-run logging

> `challenge/challenge-context.service.ts` and `challenge/sync-evaluation.service.ts` are still in the codebase but are **no longer used** — they belonged to the old challenge-level identify/merge/evaluate pipeline (the `/api/challenges/:id/context` and `/sync` routes are their remaining surface). `webhook.service.ts` also remains but is orphaned: the `POST /api/webhooks/github` route that used to call it has been removed, so nothing in the app invokes it anymore.

---

## `packages/provisioner`

**Optional** — requires a GitHub token (for branches) or a connected Scaleway account (for GPU instances)
**Purpose:** Provisions the external resources a challenge hands to a contributor, behind one provider registry.

Providers:
- **`github-branch.provider.ts`** — a personal branch per contributor on the challenge's repo, protected so only they can push. Entry point: `provisionContributorWorkspace()`.
- **`scaleway-gpu.provider.ts`** — a temporary GPU instance (`L4-1-24G` by default) — see [`compute-power.md`](./compute-power.md).

**Key files:** `packages/provisioner/src/index.ts`, `packages/provisioner/src/registry.ts`, `packages/provisioner/src/providers/`

---

## `packages/sync-meeting-agent`

**Optional** — requires `OPENAI_API_KEY` + Google Workspace credentials
**Purpose:** AI agent that analyzes the content of a sync meeting. Takes meeting transcript/notes and produces structured output: summary, key decisions, action items, and contribution signals.

Output schema (validated with Zod):
- Summary of the meeting
- List of decisions made
- List of action items with assignees
- Contribution signals extracted (who did what)

**Key file:** `packages/sync-meeting-agent/meeting-analyzer.ts`

---

## `packages/scaleway`

**Optional** — requires a Scaleway account connected by an admin
**Purpose:** A thin client for the Scaleway Instances API — create, read, delete a server, and `testConnection()` used to verify credentials at connection time. It carries no ML tooling of its own: the toolchain is expected to already be on the marketplace image.

**Key file:** `packages/scaleway/client.ts` — see [`compute-power.md`](./compute-power.md)

---

## `packages/slack-signal-agent`

**Optional** — requires `OPENAI_API_KEY` + a connected Slack bot
**Purpose:** AI agent that detects the contribution signals defined on a challenge inside a batch of Slack messages. Receives the challenge context, the participants (already resolved by email), the signal definitions, and the messages; returns per-message detections attributed to participants.

Output schema (validated with Zod, plus post-parse guards):
- One detection per (signal, message, user) triple: `signal_id`, `user_id`, `message_ts`, `justification`
- Detections with unknown signal/user/message identifiers are dropped

See [`slack-signals.md`](./slack-signals.md) for the full pipeline.

**Key file:** `packages/slack-signal-agent/openai/detect.agent.ts`

---

## `packages/test`

**Development only**
**Purpose:** Ad-hoc scripts for manually testing integrations. Not Vitest tests — these are run directly with `tsx`.

Examples:
```bash
npx tsx packages/test/test-db-connection.ts
npx tsx packages/test/test-github.ts
npx tsx packages/test/test-gd.ts
npx tsx packages/test/test-provisioner.ts
npx tsx packages/test/test-challenge-service.ts
npx tsx packages/test/test-create-challenge.ts
npx tsx packages/test/test-webhook-service.ts
```

> Some of these predate the current model (`test-webhook-service.ts` exercises the orphaned webhook service) — treat them as scratch tools, not a suite.

> Some scripts require optional env variables (GitHub, Google, OpenAI).
