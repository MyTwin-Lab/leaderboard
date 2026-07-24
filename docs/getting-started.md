# Getting started

This guide covers setting up the project locally from scratch.

**Prerequisites:**
- Node.js 18+
- PostgreSQL 14+

---

## 1. Clone and install dependencies

```bash
git clone <repo-url>
cd leaderboard
npm install
```

---

## 2. Create a PostgreSQL database

Start PostgreSQL and create a database and user:

```sql
CREATE USER leaderboard_user WITH PASSWORD 'leaderboard_password';
CREATE DATABASE mytwin_leaderboard OWNER leaderboard_user;
```

---

## 3. Configure environment variables

Create a `.env` file at the **repo root**:

```env
# Required
DATABASE_URL=postgresql://leaderboard_user:leaderboard_password@localhost:5432/mytwin_leaderboard
JWT_SECRET=replace-with-a-32+character-secret-at-least

# Required — Google OAuth (used for login)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-auth/callback

# Optional — only needed for AI evaluation
OPENAI_API_KEY=

# Optional — only needed for GitHub integration (static token option — see github-setup.md)
GITHUB_TOKEN=

# Optional — only needed for the in-app GitHub OAuth connection (see github-setup.md)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
GITHUB_TOKEN_ENCRYPTION_KEY=

# Optional — only needed for Kaggle (ML challenges) if not connected via the UI
KAGGLE_USERNAME=
KAGGLE_KEY=

# Optional — only needed for Google Drive connector
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_FOLDER_ID=

# Optional — only needed for sync meetings (Google Workspace)
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY=
GOOGLE_WORKSPACE_ADMIN_EMAIL=

# Optional — secures the meeting-polling cron endpoint
CRON_SECRET=

# Optional — observability (Grafana Cloud)
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=
OTEL_SERVICE_NAME=leaderboard-api
```

Then copy it for the Next.js app (which reads from `.env.local`):

```bash
# macOS / Linux
cp .env apps/leaderboard-client/.env.local

# Windows (PowerShell)
Copy-Item .env apps/leaderboard-client/.env.local
```

> The root `.env` is used by Drizzle (schema push) and the seed script. The `apps/leaderboard-client/.env.local` is used by Next.js at runtime. Both must exist.

---

## 4. Initialize the database schema

Run the init script for your OS:

```bash
# macOS / Linux
npm run init:macos

# Windows
npm run init:windows
```

Or manually:

```bash
npm run db:push
```

This pushes the Drizzle schema to your local database.

---

## 5. Seed initial data

```bash
npm run populate-db
```

This inserts the starter projects, users, challenges, and contributions from `db_data/*.json`.

> **Warning:** This is destructive — it deletes existing rows first. Don't run it against a database with real data you want to keep.

---

## 6. Start the development server

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Invalid environment configuration: JWT_SECRET…` | Make sure `JWT_SECRET` is at least 32 characters in your `.env` |
| Drizzle or seed can't connect | Check that Postgres is running, `DATABASE_URL` is correct, and the DB/user exist |
| API calls fail but app starts | Make sure you copied `.env` to `apps/leaderboard-client/.env.local` |
| `next build` fails with missing `OPENAI_API_KEY` | Use `npm run prod:min` for production, or set the key in `.env` |

---

## Useful commands

```bash
npm run dev            # Start Next.js dev server
npm run db:push        # Apply schema changes to local DB
npm run db:studio      # Open Drizzle Studio (DB browser)
npm run populate-db    # Reset + seed the database
npm test               # Run all tests
```

See [`deployment.md`](./deployment.md) for production setup.
