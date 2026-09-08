# Digest

The digest is a periodic, immutable snapshot of platform activity — generated automatically on a configurable schedule, browsable by admins from their profile page.

**Requires:** nothing beyond the database. Pure SQL aggregation, no AI agent, no external integration.

---

## What it does

1. A cron endpoint runs daily and checks whether a new digest is due, based on the configured frequency and the end of the last digest's period.
2. When due, it aggregates everything new since the last digest into a frozen JSON payload and stores it as a new `digests` row.
3. Admins browse the digest history from a **Digest** tab on their profile page (`/contributors/me`), configure the frequency, and can trigger a generation manually at any time.

---

## Content

Each digest covers the interval `[period_start, period_end]` and contains exactly four sections:

| Section | Content |
|---------|---------|
| `new_contributions` | Contributions created in the period, with contributor name, challenge title, and CP awarded |
| `new_challenges` | Challenges created in the period |
| `completed_challenges` | Challenges that reached completion in the period |
| `new_contributors` | Users who joined in the period |

Out of scope (deliberately): Slack signals, evaluation runs, meeting analyses, leaderboard movements. The digest reports facts, not analysis.

### Snapshot semantics

The payload stores **denormalized data** (names, titles, CP amounts as they were at generation time), not just IDs. Digests are historical records: if a contribution is later deleted, a reward cache is rebuilt by `db-resync-rewards`, or a contributor is renamed, past digests stay readable and keep reflecting what actually happened during their period.

A digest is **never regenerated or updated** after creation.

---

## Scheduling model

There is no dynamic cron schedule. The cron runs daily (same pattern as `slack-signals`); the decision to generate lives in the endpoint:

```
period_end of last digest  =  cursor
if now - cursor >= digest_frequency_days  →  generate over [cursor, now]
else                                      →  no-op
```

The `digests` table is its own cursor — no "last generated" field in `app_settings`, and no possible gap or overlap between two consecutive digests. The first digest ever uses the configured frequency as a lookback window (`[now - frequency, now]`).

### Manual generation

The **Generate now** button in the admin tab calls the same generation code path, skipping only the frequency check. It generates over `[last period_end, now]` like any other run, so the cursor invariant holds: the next automatic digest simply starts where the manual one ended. A manual digest with a very short period is valid and may have mostly empty sections.

---

## Configuration

Two fields on the `app_settings` singleton, edited from the Digest tab:

| Field | Purpose |
|-------|---------|
| `digest_enabled` | Master switch — when off, the cron no-ops (manual generation still works) |
| `digest_frequency_days` | Interval between automatic digests (default `7`) |

---

## Database

| Table | Purpose |
|-------|---------|
| `digests` | One row per generated digest: `id`, `period_start`, `period_end`, `generated_at`, `trigger` (`cron` / `manual`), `payload` (jsonb, the four sections) |

`period_start` always equals the previous digest's `period_end`.

---

## API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/digests` | List digests, newest first (paginated). | Admin |
| `GET` | `/api/digests/:id` | Read one digest's full payload. | Admin |
| `POST` | `/api/digests/generate` | Manual generation over `[last period_end, now]`. | Admin |
| `PATCH` | `/api/admin/digest-settings` | Update `digest_enabled` / `digest_frequency_days`. | Admin |
| `GET` | `/api/cron/digest` | Daily check + generation when due. | `Bearer $CRON_SECRET` |

The cron endpoint follows the existing pattern: secured by `CRON_SECRET`, declared in `vercel.json`, or curled by an external scheduler on Scalingo / PM2 (see [`deployment.md`](./deployment.md#cron-jobs)).

---

## UI

A **Digest** tab on the admin profile page (`/contributors/me`), alongside Appearance / Integrations / Modules:

- Digest history, newest first — each entry expandable to show its four sections.
- Frequency setting + enable toggle.
- **Generate now** button (disabled while a generation is in progress).

---

## Key files (planned)

| File | Purpose |
|------|---------|
| `packages/database-service/repositories/digest.repo.ts` | `digests` CRUD + last-period lookup |
| `packages/services/digest/digest.service.ts` | Aggregation queries + snapshot assembly |
| `packages/services/digest/cron-digest.ts` | Frequency check + generation trigger |
| `apps/leaderboard-client/src/app/api/cron/digest/route.ts` | Cron entry point |
| `apps/leaderboard-client/src/app/api/digests/` | List / read / generate routes |
| `apps/leaderboard-client/src/app/api/admin/digest-settings/route.ts` | Settings endpoint |
| `apps/leaderboard-client/src/components/admin/DigestTab.tsx` | Profile page tab |

> Schema note: the two new `app_settings` columns and the `digests` table must also be added to `scripts/db-apply-schema.ts` — the deploy path doesn't run `drizzle-kit push` (see [`database.md`](./database.md#migrations)).
