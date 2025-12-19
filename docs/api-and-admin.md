# API and Admin (optional)

The primary “Getting Started” flow for this repo focuses on the Next.js app (`apps/leaderboard-client`) running directly against PostgreSQL.

This repo also contains:

## REST API (Express) — `packages/api`

- Purpose: expose a REST interface for projects/challenges/users/contributions/leaderboard.
- Docs: `packages/api/README.md`

Running it is **optional** for the UI-only local setup.

## Legacy admin UI — `apps/admin`

This is a static HTML/CSS/JS admin interface.

- Docs: `apps/admin/README.md`

It is primarily designed to talk to the Express API, and is therefore also **optional** for the UI-only setup.
