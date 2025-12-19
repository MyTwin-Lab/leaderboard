# Project structure

## Top-level layout

```
leaderboard/
├── apps/
│   ├── leaderboard-client/   # Next.js app (UI + Route Handlers)
│   └── admin/                # Legacy static admin UI (optional)
├── packages/
│   ├── api/                  # Express REST API (optional)
│   ├── config/               # Environment validation / config
│   ├── connectors/           # External connectors (GitHub, Google Drive)
│   ├── database-service/     # PostgreSQL schema + repositories (Drizzle)
│   ├── evaluator/            # AI evaluator + scoring grids (optional)
│   ├── services/             # Orchestration services (optional)
│   └── test/                 # Ad-hoc test scripts (connectors/services/db)
├── db_data/                  # Seed JSON + seed script
├── drizzle/                  # Generated migrations / snapshots
├── challenges/               # Challenge specs (docs)
├── scripts/                  # OS helper scripts
└── docs/                     # Project documentation (this folder)
```

## Where to look for…

- **Next.js UI**: `apps/leaderboard-client/src/app`
- **Next Route Handlers**: `apps/leaderboard-client/src/app/api/*`
- **Auth helpers**: `apps/leaderboard-client/src/lib/auth.ts`
- **Protected routes**: `apps/leaderboard-client/src/middleware.ts`
- **DB schema + client**: `packages/database-service/db/drizzle.ts`
- **Repositories**: `packages/database-service/repositories/*`
- **Seed/reset data**: `db_data/seed.ts` + `db_data/*.json`
- **Drizzle config**: `drizzle.config.ts`
- **Root scripts**: `package.json`


