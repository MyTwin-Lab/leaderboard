# Packages

This monorepo is organized into one app and several packages. Packages are shared libraries — they are not deployed independently, they are imported by the app or by each other.

---

## `apps/leaderboard-client`

**Type:** Next.js 16 application (App Router)
**Role:** The single deployable artifact. Serves the UI and handles all server-side logic via Route Handlers.

Key responsibilities:
- Renders all pages: leaderboard, challenges, contributor profiles, admin panel, onboarding
- Implements all API endpoints under `src/app/api/`
- Handles authentication (JWT cookies, middleware protection)
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
- `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET` — optional
- `GOOGLE_*` — various Google integration credentials (optional)
- `OTEL_*` — observability config (optional)

**Key file:** `packages/config/index.ts`

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
`project`, `repo`, `challenge`, `challengeRepos`, `challengeTeam`, `user`, `contribution`, `task`, `taskAssignee`, `taskWorkspace`, `evaluationGrids`, `evaluationRuns`, `evaluationRunContributions`, `syncMeeting`, `meetingParticipant`, `meetingAnalysis`, `onboardingProgress`, `refreshToken`

**Key file:** `packages/database-service/db/drizzle.ts`

---

## `packages/evaluator`

**Optional** — requires `OPENAI_API_KEY`
**Purpose:** AI-powered pipeline that identifies contributions from raw context, merges them with existing records, and scores them using structured grids.

Three-step pipeline:
1. **Identify** (`openai/identify.agent.ts`) — takes challenge context (commits, meeting notes, etc.) and extracts individual contributions
2. **Merge** (`openai/merge.agent.ts`) — compares new contributions with existing ones to decide whether to create or update
3. **Evaluate** (`openai/evaluate.agent.ts`) — scores each contribution against a grid (0–9 per criterion, aggregated to 0–100)

Scoring grids (in `grids/`):
- `code.grid.ts` — code quality: technical quality, architecture, impact, documentation, security, maintainability
- `model.grid.ts` — ML model contributions
- `dataset.grid.ts` — dataset contributions
- `docs.grid.ts` — documentation contributions

Each agent call is wrapped with 3-retry logic with 1-second backoff.

**Key file:** `packages/evaluator/evaluator.ts` (`OpenAIAgentEvaluator` class)

---

## `packages/connectors`

**Optional** — requires GitHub/Google credentials
**Purpose:** Fetches raw content from external data sources. All connectors implement a common `ExternalConnector` interface.

Available connectors:
- **GitHub** — fetch commits, file contents, repository metadata via Octokit
- **Google Drive** — list and read files from a Drive folder via OAuth2

Interface methods: `connect()`, `testConnection()`, `fetchItems()`, `fetchItemContent()`, `disconnect()`

**Key files:** `packages/connectors/github/`, `packages/connectors/google-drive/`

---

## `packages/services`

**Optional** — orchestrates the optional packages
**Purpose:** Business logic and orchestration that combines database access, connectors, and the evaluator. The app calls these services from Route Handlers rather than calling the lower-level packages directly.

Key services:
- **`challenge.service.ts`** — challenge CRUD and state transitions
- **`challenge-context.service.ts`** — assembles the full context (commits, notes) for evaluation
- **`sync-evaluation.service.ts`** — triggers the full identify → merge → evaluate pipeline
- **`rewards.service.ts`** — distributes CP across contributors based on evaluation scores
- **`google-auth.service.ts`** — manages Google OAuth2 tokens
- **`google-calendar.service.ts`** — creates and manages Google Calendar events
- **`google-meet.service.ts`** — provisions Google Meet links
- **`evaluation-grid.service.ts`** — CRUD for evaluation grids stored in the DB
- **`webhook.service.ts`** — handles incoming GitHub webhooks
- **`sync-meeting/`** — full sync meeting lifecycle (creation → polling → ingestion → analysis)

---

## `packages/provisioner`

**Optional** — requires `GITHUB_TOKEN`
**Purpose:** Creates workspaces for tasks on external platforms. Currently supports creating GitHub branches for a challenge/task.

```typescript
const result = await provisionChallengeWorkspace({
  challengeIndex: 7,
  challengeTitle: 'My Challenge',
  repoExternalId: 'org/repo',
  repoType: 'github',
});
// Returns: { provider, ref, url, status, meta }
```

**Key file:** `packages/provisioner/github-branch.provider.ts`

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

## `packages/test`

**Development only**
**Purpose:** Ad-hoc scripts for manually testing integrations. Not Vitest tests — these are run directly with `tsx`.

Examples:
```bash
npx tsx packages/test/test-db-connection.ts
npx tsx packages/test/test-github-connector.ts
```

> Some scripts require optional env variables (GitHub, Google, OpenAI).
