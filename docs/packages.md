# Packages

This monorepo holds one app, the **core** (`packages/`), **installed content** (`content/`) and **product modules** (`modules/`). None of them is deployed on its own: the app imports them, and its distribution manifest decides what is installed. The import rules between these zones are in [`architecture.md`](./architecture.md#import-boundaries); adding a flow is described in [`writing-a-flow.md`](./writing-a-flow.md).

---

## `apps/leaderboard-client`

**Type:** Next.js 16 application (App Router)
**Role:** The single deployable artifact. Serves the UI and handles all server-side logic via Route Handlers.

Key responsibilities:
- Renders all pages: leaderboard, challenges, contributor profiles, admin panel, sandbox
- Implements all API endpoints under `src/app/api/`, including the generic flow/extension action routes, `/api/integrations/*`, `/api/cron/tick`, `/api/modules` and `/api/events/ui`
- Handles authentication (JWT cookies, route protection in `src/proxy.ts`)
- **`src/distribution/`** — the composition root for MyTwin:
  - `mytwin.platform.ts` — flows, extensions, kits and modules installed
  - `mytwin.server.ts` — connectors, integrations, bundle sources, providers and grids; installed by `src/instrumentation.ts`
  - `mytwin.client.tsx`, `mytwin.forms.tsx`, `mytwin.activity.tsx`, `mytwin.integrations.tsx` — client slots per flow and connector (`client/`, `forms/`, `activity/`)
  - `mytwin.modules.tsx`, `mytwin.proxy.ts` — module slots and module route rules (`modules/`)

---

## Core — `packages/`

### `packages/registry`

`PlatformRegistry` (`platform.ts`): flows, extensions, kits, modules, qualifications, rule keys, contribution types, jobs, events, subscriptions, quests, evaluation handlers and CP sources. Installation fails on a duplicate key or on a subscription or quest bound to an undeclared event. Also holds the architecture, empty-distribution and example-flow tests.

### `packages/capabilities`

What flows, extensions and modules build on:
- **`evaluation.ts`** — `evaluate({ bundle, gridSlug, subject })`, runs and their retry; `bundle.ts` prepares and cleans the snapshot
- **`challenge-actions.ts`** / **`challenge-hooks.ts`** — the action dispatcher with declared access, and the `onCreate` / `onJoin` / `onGroupJoin` / `onClose` / `onDelete` hooks
- **`board.ts`**, **`groups.ts`**, **`qualifications.ts`** — personal task board, group policy, user qualifications
- **`resources.ts`** — claimable work units: import, `draw` bounded by `k` with TTL and one live claim per person, `consume`, `release`, `close` (`resource_instances`, `resource_claims` — see [`data-annotation.md`](./data-annotation.md))
- **`pool.ts`**, **`economy.ts`**, **`rewards.ts`**, **`deliverables.ts`**, **`flow-config.ts`**, **`grid-seeds.ts`**
- **`cron.ts`** — the job registry behind `/api/cron/tick` (`cron_runs`)
- **`events.ts`** — outbox: `emit`, `distribute`, `purge`
- **`modules.ts`** — module state and settings (`module_settings`)
- **`crypto.ts`**, **`credentials.ts`** — encryption and the `integration_credentials` store
- **`identity/google-auth.ts`** — Google OAuth login
- **`http-proxy/`** — `ssrf-guard.ts` (`assertPublicHttpUrl`, guarded DNS lookup) and `endpoint-proxy.ts` (the proxied call to a contributor's endpoint)
- **`testing/action-context.ts`** — a fake action context for handler tests

### `packages/config`

**Required by:** everything
**Purpose:** Validates environment variables at startup with Zod, and exposes credential getters that read the credentials store first.

Variables it validates:
- `DATABASE_URL` — required
- `JWT_SECRET` — required, must be 32+ characters
- `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` — optional (defaults: `15m` / `7d`)
- `OPENAI_API_KEY` — optional fallback for the OpenAI connection
- `GITHUB_TOKEN` — optional static fallback token
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_OAUTH_REDIRECT_URI` / `GITHUB_TOKEN_ENCRYPTION_KEY` — optional (in-app GitHub OAuth connection, see [`github-setup.md`](./github-setup.md))
- `KAGGLE_USERNAME` / `KAGGLE_KEY`, `SLACK_BOT_TOKEN` — optional fallbacks (see [`admin-settings.md`](./admin-settings.md))
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT_URI` — required (login)
- Other `GOOGLE_*` — Google Workspace credentials (meetings module)
- `CRON_SECRET` — secures `/api/cron/tick`
- `OTEL_*` — observability config (optional)
- `VALIDATION_ALLOW_PRIVATE_ENDPOINTS` — optional, **local dev only** (see [`validation-challenges.md`](./validation-challenges.md))

> Scaleway has **no** env fallback — GPU compute credentials only ever come from the admin-connected account (see [`compute-power.md`](./compute-power.md)).

**Key files:** `index.ts`, `githubToken.ts`, `kaggleCredentials.ts`, `slackCredentials.ts`, `openaiCredentials.ts`, `scalewayCredentials.ts`

### `packages/database-service`

**Purpose:** PostgreSQL schema + typed repositories. The only package that talks to the database directly.

- **Schema** (`db/drizzle.ts`), **mappers** (`db/mappers.ts`), **domain types** (`domain/entities.ts`, `domain/schemas_zod.ts`)
- **Repositories** (`repositories/`) — one per domain area, among them the platform tables: `cronRun`, `platformEvent`, `eventDelivery`, `moduleSetting`, `integrationCredential`, `userQualification`, `onboardingProgress`
- `domain/legacyFlowConfig.ts`, `domain/legacyProposalFields.ts` — read fallbacks for columns kept until they are dropped

### `packages/evaluator`

**Purpose:** The OpenAI scoring agent (`openai/evaluate.agent.ts`, 0–9 per criterion, 3 retries) and the grid registry (`grids/index.ts`), which has no built-in grid: grids are content seeds (`content/grids/{code,dataset,model}`) inserted at deploy time by `npm run db:seed-grids`. Callers go through `evaluate()`; reward math belongs to the flows.

**Key file:** `evaluator.ts` (`OpenAIAgentEvaluator`)

### `packages/connectors`

**Purpose:** The `ExternalConnector` interface and `ConnectorRegistry` (`interfaces.ts`, `registry.ts`), the opaque activity shape `{ connectorKey, payload }` (`activity.ts`), and `IntegrationRegistry` (`integrations.ts`) — each integration declares its auth mode (`oauth` or `api_key` + fields), its test and its public fields. The connectors themselves are content.

### `packages/provisioner`

**Purpose:** The provider interface and `ProvisionerRegistry` (`src/registry.ts`, `src/index.ts`). A provider reports whether it is available from the credentials store; the providers themselves are content.

### Not yet sorted

Still in `packages/` but outside the core rules (see `UNSORTED_PREFIXES` in the architecture test):
- **`packages/services/`** — service code used by flows and modules: `challenge/` (code and ML rewards, repo evaluation, validation and reference cases, scenarios, SSRF guard, endpoint proxy), `compute/`, `digest/`, `google-workspace/` (calendar, meet), `sandbox/`, `slack/`, `sync-meeting/`, `evaluation-grid.service.ts`, `database-grid-provider.ts`
- **`packages/sync-meeting-agent/`** — AI analysis of a meeting transcript (`meeting-analyzer.ts`)
- **`packages/slack-signal-agent/`** — AI detection of a challenge's contribution signals in Slack messages (`openai/detect.agent.ts`, see [`slack-signals.md`](./slack-signals.md))

---

## Content — `content/`

| Kind | Entries |
|------|---------|
| `flows/` | `code` (project on a branch, board-gated evaluation), `ml` (datasets, models, packaging), `endpoint-validation`, `journey-validation`, `data-annotation` (labeling campaigns on the `resources` capability) — each exports a `FlowDefinition` from `index.ts` |
| `kits/validation` | validation targets, validator contribution and `cp_per_validation` payment, shared by the two validation flows |
| `extensions/` | `slack-signals` (every flow), `compute` (ML: GPU requests, Scaleway client and provider in `compute/scaleway/`) |
| `connectors/` | `github`, `kaggle`, `slack` — connector, integration and activity extractor |
| `integrations/openai` | the OpenAI API key connection |
| `bundle-sources/` | `github-snapshot`, `kaggle-artifact` |
| `workspace-providers/` | `github-branch` (a protected personal branch per contributor) |
| `grids/` | `code`, `dataset`, `model` seeds |

---

## Modules — `modules/`

Each exports a `ModuleDefinition` (key, default state, settings schema, jobs, events, subscriptions). Disabled, a module's routes answer 404, its jobs are skipped and its slots hidden. See [`admin-settings.md`](./admin-settings.md).

| Module | Role |
|--------|------|
| `meetings` | Google Meet sync meetings and their analysis — off by default ([`sync-meetings.md`](./sync-meetings.md)) |
| `onboarding` | records quests from platform events (`questRecorder`) ([`onboarding.md`](./onboarding.md)) |
| `digest` | periodic activity snapshots ([`digest.md`](./digest.md)) |
| `sandbox` | contributor proposals for any flow that declares `proposable`, star economy and promotion ([`sandbox.md`](./sandbox.md)) |
