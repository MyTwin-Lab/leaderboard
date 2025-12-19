# Packages and apps

## Apps

- `apps/leaderboard-client` — Next.js app (UI + Next Route Handlers). In the current setup, it can access PostgreSQL through `packages/database-service`.
- `apps/admin` — legacy static admin UI (optional). See `apps/admin/README.md`.

## Packages

- `packages/config`
  - Environment validation and configuration (Zod).
  - Note: `JWT_SECRET` is required.

- `packages/database-service`
  - Drizzle schema + repositories for PostgreSQL.
  - Source: `packages/database-service/db/drizzle.ts`
  - Doc: `packages/database-service/README.md`

- `packages/connectors` (optional)
  - External connectors (GitHub, Google Drive).
  - Doc: `packages/connectors/README.md`

- `packages/evaluator` (optional)
  - Contribution identification + evaluation using scoring grids (OpenAI-based).
  - Doc: `packages/evaluator/README.md`

- `packages/services` (optional)
  - Orchestration services (e.g. challenge lifecycle).

- `packages/api` (optional)
  - Express REST API backend.
  - Doc: `packages/api/README.md`


