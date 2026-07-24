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
│       │   │   ├── page.tsx           # New curated homepage (about + top 5 + trending challenges)
│       │   │   ├── leaderboard/       # Full leaderboard (moved here from `/`)
│       │   │   ├── about/             # About page
│       │   │   ├── admin/             # Admin section (protected, admin role only)
│       │   │   │   ├── challenges/
│       │   │   │   ├── contributions/
│       │   │   │   ├── evaluation-grids/
│       │   │   │   ├── evaluation-runs/
│       │   │   │   ├── meetings/
│       │   │   │   ├── projects/
│       │   │   │   ├── repos/
│       │   │   │   └── users/
│       │   │   ├── api/               # Next.js Route Handlers (server-side)
│       │   │   │   ├── admin/theme/   # instance-wide theme (admin only)
│       │   │   │   ├── auth/          # refresh, logout (login is handled by google-auth/)
│       │   │   │   ├── challenges/    # CRUD + sync + team + documents + repo-activity + ml-workspace + ml-rewards
│       │   │   │   ├── contributions/ # CRUD by challenge + per-contribution reward ledger
│       │   │   │   ├── contributors/  # current user profile + tasks
│       │   │   │   ├── evaluation-grids/
│       │   │   │   ├── evaluation-runs/ # admin viewer/retry for past evaluation runs
│       │   │   │   ├── github-oauth/  # admin GitHub account connection
│       │   │   │   ├── google-auth/   # OAuth authorize + callback
│       │   │   │   ├── kaggle/        # admin Kaggle account connection
│       │   │   │   ├── leaderboard/   # rankings endpoint
│       │   │   │   ├── modules/       # meetings/onboarding visibility toggles
│       │   │   │   ├── onboarding/    # onboarding progress (+ /all for admins)
│       │   │   │   ├── projects/
│       │   │   │   ├── repos/
│       │   │   │   ├── sync-meetings/
│       │   │   │   ├── tasks/
│       │   │   │   ├── users/
│       │   │   │   ├── cron/          # background jobs (check-meetings)
│       │   │   │   ├── docs/          # Scalar API reference (dev only)
│       │   │   │   └── openapi.json/  # OpenAPI spec (dev only)
│       │   │   ├── challenges/        # challenge listing + detail pages
│       │   │   │   └── [id]/manage/   # project-manager view (mirrors the admin challenge view)
│       │   │   ├── contributors/      # contributor profile pages
│       │   │   ├── sync-meetings/     # meeting detail page
│       │   │   └── tasks/             # task detail page
│       │   ├── components/
│       │   │   ├── admin/             # admin UI components
│       │   │   ├── challenges/        # manager-role popup, challenge cards/filters
│       │   │   ├── home/              # homepage preview sections (leaderboard, trending challenges)
│       │   │   └── contributor/       # contributor-facing components (incl. ThemeSettings, task board)
│       │   ├── lib/
│       │   │   ├── auth.ts            # JWT helpers (sign, verify, cookies)
│       │   │   ├── db.ts              # database client instance
│       │   │   ├── leaderboard.ts     # leaderboard computation
│       │   │   ├── themes.ts          # predefined theme palettes
│       │   │   ├── onboarding-track.ts
│       │   │   ├── otel.ts            # OpenTelemetry setup
│       │   │   ├── types.ts           # shared TypeScript types
│       │   │   ├── validation.ts      # Zod schemas for API inputs
│       │   │   └── server/            # server-only utilities (incl. managerAuth.ts)
│       │   ├── proxy.ts               # route protection (JWT check, Edge runtime — formerly middleware.ts)
│       │   └── instrumentation.ts     # observability init
│       ├── package.json
│       └── next.config.ts
│
├── packages/
│   ├── config/                        # env variable validation (Zod)
│   │   └── index.ts
│   │
│   ├── database-service/              # PostgreSQL schema + repositories
│   │   ├── db/
│   │   │   ├── drizzle.ts             # schema definition (source of truth)
│   │   │   └── mappers.ts             # DB rows ↔ domain entities
│   │   ├── domain/
│   │   │   ├── entities.ts            # TypeScript domain types
│   │   │   └── schemas_zod.ts         # Zod validation schemas
│   │   └── repositories/              # one file per table/domain area
│   │
│   ├── evaluator/                     # AI evaluation + ML reward scoring
│   │   ├── evaluator.ts               # OpenAIAgentEvaluator class
│   │   ├── interfaces.ts
│   │   ├── types.ts
│   │   ├── reward.ts                  # CP reward distribution (code challenges)
│   │   ├── ml-reward.ts               # point scoring for ML challenges (see ml-rewards.md)
│   │   ├── grids/                     # scoring grids (code, model, docs, dataset)
│   │   └── openai/                    # identify + evaluate + merge agents
│   │
│   ├── connectors/                    # external data source connectors
│   │   ├── github/                    # GitHub API (commits, files, repos, activity)
│   │   ├── kaggle/                    # Kaggle datasets/models (metadata, metrics, activity)
│   │   └── google-drive/              # Google Drive file access
│   │
│   ├── services/                      # orchestration and business logic
│   │   ├── challenge.service.ts       # challenge operations
│   │   ├── challenge-context.service.ts
│   │   ├── sync-evaluation.service.ts
│   │   ├── rewards.service.ts
│   │   ├── challenge/
│   │   │   ├── ml-rewards.service.ts  # ML reward orchestration (see ml-rewards.md)
│   │   │   ├── artifactUrl.ts         # URL normalization (reuse detection key)
│   │   │   └── lineage.ts             # reuse/authorship detection
│   │   ├── google-auth.service.ts
│   │   ├── google-calendar.service.ts
│   │   ├── google-meet.service.ts
│   │   ├── evaluation-grid.service.ts
│   │   └── sync-meeting/              # sync meeting orchestration
│   │       ├── sync-meeting.service.ts
│   │       ├── meeting-polling.service.ts
│   │       ├── meeting-ingestion.service.ts
│   │       ├── meeting-analysis.service.ts
│   │       └── cron-check-meetings.ts
│   │
│   ├── provisioner/                   # workspace provisioning
│   │   └── github-branch.provider.ts  # creates GitHub branches for tasks
│   │
│   ├── sync-meeting-agent/            # AI analysis of sync meetings
│   │   ├── meeting-analyzer.ts
│   │   ├── openai/analyze.agent.ts
│   │   ├── schemas.ts
│   │   ├── types.ts
│   │   └── prompts.ts
│   │
│   └── test/                          # ad-hoc test scripts (not Vitest)
│
├── db_data/                           # seed data
│   ├── seed.ts                        # seed script
│   ├── projects.json
│   ├── users.json
│   ├── challenges.json
│   └── contributions.json
│
├── drizzle/                           # generated SQL migrations
├── challenges/                        # team roadmap / brief / spec files (not code)
├── scripts/                           # OS-specific helper scripts
│   ├── prod.sh
│   ├── macos/init.sh
│   └── windows/init.bat
├── docs/                              # this documentation
├── .env.example                       # env variable template
├── drizzle.config.ts                  # Drizzle ORM config
├── package.json                       # root scripts + workspace definition
├── tsconfig.json
└── vercel.json
```

## Where to look for…

| What | Where |
|------|-------|
| Page UI | `apps/leaderboard-client/src/app/**/*.tsx` |
| API endpoints | `apps/leaderboard-client/src/app/api/**/route.ts` |
| Route protection | `apps/leaderboard-client/src/proxy.ts` |
| Auth helpers | `apps/leaderboard-client/src/lib/auth.ts` |
| Project-manager authorization | `apps/leaderboard-client/src/lib/server/managerAuth.ts` |
| DB schema | `packages/database-service/db/drizzle.ts` |
| DB repositories | `packages/database-service/repositories/` |
| Seed data | `db_data/seed.ts` + `db_data/*.json` |
| Drizzle config | `drizzle.config.ts` (root) |
| AI evaluation (code challenges) | `packages/evaluator/` |
| ML challenge rewards | `packages/evaluator/ml-reward.ts` + `packages/services/challenge/` (see [`ml-rewards.md`](./ml-rewards.md)) |
| Google integrations | `packages/services/google-*.service.ts` |
| Meeting analysis | `packages/sync-meeting-agent/` |
| Theme / integrations / module toggles | `packages/database-service/repositories/appSettings.repo.ts` (see [`admin-settings.md`](./admin-settings.md)) |
| Env config | `packages/config/index.ts` |
| Root npm scripts | `package.json` (root) |
