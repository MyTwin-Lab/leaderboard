# Database (PostgreSQL + Drizzle)

## What’s used

- **PostgreSQL** as the database.
- **Drizzle ORM** for schema + queries (`packages/database-service`).
- **drizzle-kit** for schema push / studio (`drizzle.config.ts`).

## Required environment

The DB tooling reads:

- `DATABASE_URL` (required)

Example:

```env
DATABASE_URL=postgresql://leaderboard_user:leaderboard_password@localhost:5432/mytwin_leaderboard
```

## Schema source of truth

- Schema definitions live in `packages/database-service/db/drizzle.ts`.
- Drizzle-kit uses that file via `drizzle.config.ts`.

## Common commands (repo root)

- **Generate migrations** (if/when you use migrations):

```bash
npm run db:generate
```

- **Push schema to the database**:

```bash
npm run db:push
```

- **Open Drizzle Studio**:

```bash
npm run db:studio
```

## Reset + seed initial data

This repo includes a seed script that:

1. Deletes rows from tables (in dependency order)
2. Inserts initial data from JSON files under `db_data/`

Run from repo root:

```bash
npm run populate-db
```

Data sources:

- `db_data/projects.json`
- `db_data/users.json`
- `db_data/challenges.json`
- `db_data/contributions.json`

Important:

- This is a **destructive** reset (it clears existing rows first).
- IDs are regenerated (UUIDs) and mapped internally during seeding.


