# MyTwin Leaderboard

An AI agent that tracks each contribution, evaluates work quality, and automatically distributes rewards to MyTwin Lab contributors — powering a community, competitive leaderboard.

## Getting Started (local development)

### Prerequisites

- Node.js **18+**
- PostgreSQL **14+**

### 1) Install dependencies

From the repo root:

```bash
npm install
```

### 2) Create a local PostgreSQL database

Create a DB and a user (names are up to you). Example:

```sql
CREATE USER leaderboard_user WITH PASSWORD 'leaderboard_password';
CREATE DATABASE mytwin_leaderboard OWNER leaderboard_user;
```

Make sure PostgreSQL is running.

### 3) Create environment files

This repo runs commands from **two working directories**:

- Repo root (Drizzle, seed script)
- `apps/leaderboard-client` (Next.js dev server)

Create a root `.env` file:

```env
# Required
DATABASE_URL=postgresql://leaderboard_user:leaderboard_password@localhost:5432/mytwin_leaderboard
JWT_SECRET=replace-with-a-32+char-secret-at-least

# Optional (only needed for connectors / evaluator / API usage)
OPENAI_API_KEY=
GITHUB_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_REDIRECT_URI=
GOOGLE_FOLDER_ID=
```

Then copy it for the Next.js app:

```bash
cp .env apps/leaderboard-client/.env.local
```

On Windows (PowerShell):

```powershell
Copy-Item .env apps/leaderboard-client/.env.local
```

### 4) Initialize DB schema (Drizzle) + install app deps

Run the init script for your OS (from repo root):

For Macos and Linux:

```bash
npm run init:macos
```

For Windows:

```bash
npm run init:windows
```

If you prefer manual steps, the essential commands are:

```bash
npm run db:push
```

### 5) Reset + seed the database with initial data

This will delete existing rows and re-insert the JSON data from `db_data/*.json`:

```bash
npm run populate-db
```

### 6) Start the app

```bash
npm run dev
```

The app is a Next.js project in `apps/leaderboard-client`.

## Deployment (production)

This repo includes production scripts to build and run the Next.js app using **PM2**.

### Prerequisites

- A `.env` file at the **repo root** (same one used by Drizzle/seed)
- PM2 is installed **globally on the VPS** (commands use `pm2`)

### Two production run modes (recommended)

This repo contains optional “backend integrations” (evaluator via OpenAI + connectors via GitHub/Google Drive).
They are executed **inside the Next.js server runtime** (API routes / server code), not as separate daemons.

So in production you can choose between:

- **Full prod**: everything enabled → requires real API keys in `.env`
- **Minimal prod**: client + DB only → does **not** require API keys (the script sets placeholders so `next build` won’t crash)

### Build + run with PM2

From the repo root:

```bash
npm run prod:full
```

Minimal mode (useful when you only need the UI + DB access):

```bash
npm run prod:min
```

Defaults:

- **Port**: `3014` (override with `PORT=xxxx npm run prod`)
- **App name (PM2)**: `leaderboard-client`

### Useful PM2 commands

```bash
npm run prod:status
npm run prod:logs
npm run prod:restart
npm run prod:stop
npm run prod:delete
```

### Nginx reverse-proxy (example)

Point your subdomain (e.g. `lab.my-twin.io`) to the VPS, then proxy to the local Next.js server:

```nginx
server {
  server_name lab.my-twin.io;

  location / {
    proxy_pass http://127.0.0.1:3014;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## Troubleshooting

- **“Invalid environment configuration: JWT_SECRET …”**: set `JWT_SECRET` to **32+ characters** (see `packages/config/index.ts`).
- **Drizzle / seed can’t connect**: check `DATABASE_URL`, that Postgres is running, and the DB/user exist.
- **App starts but API calls fail**: ensure you copied `.env` to `apps/leaderboard-client/.env.local` so Next.js can read it.
- **`next build` fails with “Missing credentials … OPENAI_API_KEY”**: use `npm run prod:min` (or set `OPENAI_API_KEY` in `.env`).

## More documentation

See `docs/index.md` for architecture, packages, database, auth, workflow, and testing notes.
