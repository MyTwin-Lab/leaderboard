# Project structure

## Full directory tree

```
leaderboard/
│
├── apps/
│   └── leaderboard-client/           # Next.js 16 app — UI + all API routes
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         # Root layout (also injects the active theme)
│       │   │   ├── providers.tsx      # React Query provider
│       │   │   ├── page.tsx           # Curated homepage (hero + top contributors + trending challenges)
│       │   │   ├── globals.css        # Tailwind 4 entry + overrideable theme tokens
│       │   │   ├── leaderboard/       # Full leaderboard
│       │   │   ├── about/             # About page
│       │   │   ├── signin/            # Sign-in page
│       │   │   ├── admin/             # Admin section (protected, admin role only)
│       │   │   │   ├── challenges/  contributions/  evaluation-grids/
│       │   │   │   ├── evaluation-runs/  meetings/  projects/  repos/  users/
│       │   │   ├── challenges/        # Challenge listing + detail page
│       │   │   │   └── [id]/manage/   # Project-manager view (mirrors the admin challenge view)
│       │   │   ├── contributors/      # Contributor profiles + /me (settings, integrations, onboarding)
│       │   │   ├── sync-meetings/     # Meeting detail page
│       │   │   ├── tasks/             # Task detail page
│       │   │   └── api/               # Next.js Route Handlers — see api.md
│       │   │       ├── admin/theme/        # instance-wide theme
│       │   │       ├── auth/               # refresh, logout, check-session
│       │   │       ├── google-auth/        # OAuth authorize + callback (login)
│       │   │       ├── challenges/         # the bulk of the app — see below
│       │   │       ├── contributions/  contributors/  tasks/  users/
│       │   │       ├── projects/  repos/  leaderboard/  onboarding/  modules/
│       │   │       ├── evaluation-grids/  evaluation-runs/
│       │   │       ├── sync-meetings/
│       │   │       ├── github-oauth/  kaggle/  slack/  openai/  scaleway/
│       │   │       ├── cron/               # check-meetings, slack-signals,
│       │   │       │                       # compute-provisioning, compute-expiration
│       │   │       ├── docs/               # Scalar API reference (dev only)
│       │   │       └── openapi.json/       # OpenAPI spec (dev only)
│       │   ├── components/
│       │   │   ├── admin/             # admin drawers, editors, lists
│       │   │   ├── challenges/        # brief, code/ML/validation flows, compute panels, drawers
│       │   │   │   └── shared/        # activity, metrics, participant progress
│       │   │   ├── contributor/       # profile, task board, integration cards, settings
│       │   │   ├── home/              # homepage sections
│       │   │   ├── layout/            # navbar, navigation, session guard, background
│       │   │   ├── leaderboard/       # podium, table, filters
│       │   │   ├── onboarding/        # onboarding drawer + quests
│       │   │   ├── public/            # challenge cards, filters, project explorer
│       │   │   └── ui/                # design-system primitives (Button, Markdown, Toast…)
│       │   ├── lib/
│       │   │   ├── auth.ts            # JWT helpers (sign, verify, cookies)
│       │   │   ├── db.ts              # repository instances
│       │   │   ├── challengeBrief.ts  # brief filename convention + gate logic
│       │   │   ├── useJoinChallenge.ts
│       │   │   ├── leaderboard.ts  contributor.ts  medals.ts  taskProgress.ts
│       │   │   ├── themes.ts  color-utils.ts  formatters.ts  utils.ts  url.ts
│       │   │   ├── onboarding-track.ts  signin.ts  routeVisibility.ts
│       │   │   ├── fetchJson.ts  types.ts  validation.ts  otel.ts
│       │   │   ├── public/            # payload allowlists for anonymous visitors
│       │   │   │                      # (overview, challengeVisibility, mlRewards, repoActivity)
│       │   │   └── server/            # server-only (managerAuth, onboarding, home,
│       │   │                          #  leaderboard, publicPages, safeFileHeaders)
│       │   ├── proxy.ts               # route protection (JWT check, Edge runtime)
│       │   └── instrumentation.ts     # observability init
│       ├── vitest.config.ts           # the real test runner config (alias-aware)
│       ├── package.json
│       └── next.config.ts
│
├── packages/
│   ├── config/                        # env validation (Zod) + encrypted credentials
│   │   ├── index.ts
│   │   └── githubToken.ts  kaggleCredentials.ts  slackCredentials.ts
│   │       openaiCredentials.ts  scalewayCredentials.ts
│   │
│   ├── database-service/              # PostgreSQL schema + repositories
│   │   ├── db/
│   │   │   ├── drizzle.ts             # schema definition (source of truth)
│   │   │   └── mappers.ts             # DB rows ↔ domain entities
│   │   ├── domain/
│   │   │   ├── entities.ts            # TypeScript domain types
│   │   │   ├── schemas_zod.ts         # Zod validation schemas
│   │   │   ├── mlRewardRules.ts       # ML reward rules shape
│   │   │   └── codeRewardRules.ts     # code reward rules shape
│   │   └── repositories/              # one file per table/domain area
│   │
│   ├── evaluator/                     # AI evaluation + pure reward scoring
│   │   ├── evaluator.ts               # OpenAIAgentEvaluator class
│   │   ├── code-reward.ts             # computeCodeAward() — code challenges
│   │   ├── ml-reward.ts               # ML point scoring (see ml-rewards.md)
│   │   ├── grids/                     # scoring grids (code, dataset, model)
│   │   └── openai/                    # client + evaluate agent
│   │                                  # (identify/merge agents remain, unused)
│   │
│   ├── connectors/                    # external data source connectors
│   │   ├── implementation/            # Github, Kaggle, GD (Drive), Slack
│   │   ├── registry.ts  interfaces.ts  connectors.orchestrator.ts
│   │
│   ├── services/                      # orchestration and business logic
│   │   ├── challenge/                 # challenge, code rewards, ML rewards, snapshot,
│   │   │                              # validation + reference cases, SSRF guard,
│   │   │                              # endpoint proxy, artifactUrl, lineage
│   │   ├── compute/                   # GPU compute requests + its two crons
│   │   ├── google-workspace/          # auth, calendar, meet
│   │   ├── slack/                     # signal ingestion + cron
│   │   ├── sync-meeting/              # meeting lifecycle (create → poll → ingest → analyze)
│   │   ├── evaluation-grid.service.ts  database-grid-provider.ts  run-logger.ts
│   │   └── webhook.service.ts         # orphaned — nothing calls it
│   │
│   ├── provisioner/                   # workspace + instance provisioning
│   │   └── src/providers/             # github-branch, scaleway-gpu
│   │
│   ├── scaleway/                      # Scaleway Instances API client
│   ├── sync-meeting-agent/            # AI analysis of sync meetings
│   ├── slack-signal-agent/            # AI detection of Slack contribution signals
│   └── test/                          # ad-hoc scripts (not Vitest)
│
├── db_data/                           # seed data
│   ├── seed.ts  seed-demo.ts  seed-validation-mammo.ts
│   └── projects.json  users.json  challenges.json  contributions.json
│
├── drizzle/                           # generated SQL migrations
├── challenges/                        # team roadmap / brief / spec files (not code)
├── scripts/
│   ├── db-apply-schema.ts             # idempotent schema apply (deploy postdeploy)
│   ├── db-resync-rewards.ts           # rebuild reward/completion caches
│   ├── prod.sh
│   └── macos/  windows/               # init + launch helpers
├── docs/                              # this documentation
├── Procfile  scalingo.json  ecosystem.config.cjs  vercel.json
├── drizzle.config.ts                  # Drizzle ORM config
├── package.json                       # root scripts + workspace definition
└── tsconfig.json
```

## Where to look for…

| What | Where |
|------|-------|
| Page UI | `apps/leaderboard-client/src/app/**/*.tsx` |
| API endpoints | `apps/leaderboard-client/src/app/api/**/route.ts` |
| Route protection | `apps/leaderboard-client/src/proxy.ts` |
| What anonymous visitors may see | `apps/leaderboard-client/src/lib/public/` |
| Auth helpers | `apps/leaderboard-client/src/lib/auth.ts` |
| Project-manager authorization | `apps/leaderboard-client/src/lib/server/managerAuth.ts` |
| DB schema | `packages/database-service/db/drizzle.ts` |
| Production schema application | `scripts/db-apply-schema.ts` (see [`database.md`](./database.md#migrations)) |
| DB repositories | `packages/database-service/repositories/` |
| Seed data | `db_data/seed.ts` + `db_data/*.json` |
| AI evaluation (code challenges) | `packages/evaluator/` + `packages/services/challenge/code-rewards.service.ts` |
| ML challenge rewards | `packages/evaluator/ml-reward.ts` + `packages/services/challenge/` (see [`ml-rewards.md`](./ml-rewards.md)) |
| Validation challenges | `packages/services/challenge/reference-case.service.ts` + `validation-challenge.service.ts` (see [`validation-challenges.md`](./validation-challenges.md)) |
| GPU compute | `packages/services/compute/` + `packages/scaleway/` (see [`compute-power.md`](./compute-power.md)) |
| Google integrations | `packages/services/google-workspace/` |
| Meeting analysis | `packages/sync-meeting-agent/` |
| Slack signals | `packages/services/slack/` + `packages/slack-signal-agent/` |
| Theme / integrations / module toggles | `packages/database-service/repositories/appSettings.repo.ts` (see [`admin-settings.md`](./admin-settings.md)) |
| Env config & encrypted credentials | `packages/config/` |
| Root npm scripts | `package.json` (root) |
