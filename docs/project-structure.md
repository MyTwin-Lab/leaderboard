# Project structure

## Full directory tree

```
leaderboard/
│
├── apps/
│   └── leaderboard-client/           # Next.js 16 app — UI + all API routes
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         # Root layout
│       │   │   ├── page.tsx           # Homepage (leaderboard)
│       │   │   ├── about/             # About page
│       │   │   ├── admin/             # Admin section (protected)
│       │   │   │   ├── challenges/
│       │   │   │   ├── contributions/
│       │   │   │   ├── evaluation-grids/
│       │   │   │   ├── meetings/
│       │   │   │   ├── projects/
│       │   │   │   ├── repos/
│       │   │   │   └── users/
│       │   │   ├── api/               # Next.js Route Handlers (server-side)
│       │   │   │   ├── auth/          # refresh, logout (login is handled by google-auth/)
│       │   │   │   ├── challenges/    # CRUD + sync + team management
│       │   │   │   ├── contributions/ # CRUD by challenge
│       │   │   │   ├── contributors/  # current user profile + tasks
│       │   │   │   ├── evaluation-grids/
│       │   │   │   ├── google-auth/   # OAuth authorize + callback
│       │   │   │   ├── leaderboard/   # rankings endpoint
│       │   │   │   ├── onboarding/    # onboarding progress
│       │   │   │   ├── projects/
│       │   │   │   ├── repos/
│       │   │   │   ├── sync-meetings/
│       │   │   │   ├── tasks/
│       │   │   │   ├── cron/          # background jobs (check-meetings)
│       │   │   │   └── docs/          # internal doc route
│       │   │   ├── challenges/        # challenge listing + detail pages
│       │   │   ├── contributors/      # contributor profile pages
│       │   │   ├── sync-meetings/     # meeting detail page
│       │   │   └── tasks/             # task detail page
│       │   ├── components/
│       │   │   ├── admin/             # admin UI components
│       │   │   └── contributor/       # contributor-facing components
│       │   ├── lib/
│       │   │   ├── auth.ts            # JWT helpers (sign, verify, cookies)
│       │   │   ├── db.ts              # database client instance
│       │   │   ├── leaderboard.ts     # leaderboard computation
│       │   │   ├── onboarding-track.ts
│       │   │   ├── otel.ts            # OpenTelemetry setup
│       │   │   ├── types.ts           # shared TypeScript types
│       │   │   ├── validation.ts      # Zod schemas for API inputs
│       │   │   └── server/            # server-only utilities
│       │   ├── middleware.ts          # route protection (JWT check)
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
│   ├── evaluator/                     # AI evaluation pipeline
│   │   ├── evaluator.ts               # OpenAIAgentEvaluator class
│   │   ├── interfaces.ts
│   │   ├── types.ts
│   │   ├── reward.ts                  # CP reward distribution
│   │   ├── grids/                     # scoring grids (code, model, docs, dataset)
│   │   └── openai/                    # identify + evaluate + merge agents
│   │
│   ├── connectors/                    # external data source connectors
│   │   ├── github/                    # GitHub API (commits, files, repos)
│   │   └── google-drive/              # Google Drive file access
│   │
│   ├── services/                      # orchestration and business logic
│   │   ├── challenge.service.ts       # challenge operations
│   │   ├── challenge-context.service.ts
│   │   ├── sync-evaluation.service.ts
│   │   ├── rewards.service.ts
│   │   ├── google-auth.service.ts
│   │   ├── google-calendar.service.ts
│   │   ├── google-meet.service.ts
│   │   ├── evaluation-grid.service.ts
│   │   ├── webhook.service.ts
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
| Route protection | `apps/leaderboard-client/src/middleware.ts` |
| Auth helpers | `apps/leaderboard-client/src/lib/auth.ts` |
| DB schema | `packages/database-service/db/drizzle.ts` |
| DB repositories | `packages/database-service/repositories/` |
| Seed data | `db_data/seed.ts` + `db_data/*.json` |
| Drizzle config | `drizzle.config.ts` (root) |
| AI evaluation | `packages/evaluator/` |
| Google integrations | `packages/services/google-*.service.ts` |
| Meeting analysis | `packages/sync-meeting-agent/` |
| Env config | `packages/config/index.ts` |
| Root npm scripts | `package.json` (root) |
