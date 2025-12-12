# Authentication (JWT cookies)

The Next.js app uses **JWT access + refresh tokens stored as HTTP-only cookies**.

## Environment variables

Required:

- `JWT_SECRET` (must be **at least 32 characters**)

Optional (defaults exist in config):

- `JWT_ACCESS_EXPIRY` (default: `15m`)
- `JWT_REFRESH_EXPIRY` (default: `7d`)

## Where auth lives

- Route Handlers:
  - `apps/leaderboard-client/src/app/api/auth/login/route.ts`
  - `apps/leaderboard-client/src/app/api/auth/refresh/route.ts`
  - `apps/leaderboard-client/src/app/api/auth/logout/route.ts`
- Helpers:
  - `apps/leaderboard-client/src/lib/auth.ts`
- Protection / authorization:
  - `apps/leaderboard-client/src/middleware.ts`

## Roles and protected areas

The middleware protects:

- `/admin` (admin only)
- `/contributors/me` (admin + contributor)
- Multiple `/api/*` routes (read/write rules enforced; write generally requires admin)

## How login works (high level)

1. User submits `github_username` + `password` to `/api/auth/login`.
2. Server verifies password against `users.password_hash` in PostgreSQL.
3. Server sets two cookies:
   - `access_token` (short-lived)
   - `refresh_token` (longer-lived)
4. Refresh tokens are also stored (hashed) in the `refresh_tokens` table.


