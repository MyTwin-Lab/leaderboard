# Digest

The digest is a periodic, **immutable** snapshot of platform activity — generated automatically on a configurable schedule, browsable by admins from their profile page.

**Requires:** nothing beyond the database. Pure SQL aggregation, no AI agent, no external integration — it works on a `prod:min` instance.

---

## How it works

```
Vercel cron (daily, 05:00 UTC)
  → GET /api/cron/digest                    (Bearer CRON_SECRET)
    1. digest_enabled off → no-op
    2. read the cursor: the last digest's period_end
    3. not enough whole UTC days elapsed → no-op
    4. otherwise aggregate [cursor, now] into a frozen JSON payload
       and insert one `digests` row
```

Admins browse the history from a **Digest** tab on `/contributors/me`, set the frequency, and can trigger a generation manually at any time.

---

## Content

Each digest covers `[period_start, period_end]` and contains five sections.

| Section | Source | Content |
|---------|--------|---------|
| `new_contributions` | `contributions.created_at` | Contributions created in the period — every contributor, the challenge, and the CP at snapshot time |
| `new_challenges` | `challenges.created_at` | Challenges created in the period |
| `completed_challenges` | `challenges.closed_at` | Challenges that flipped to `completed`, with the pool and what it actually paid out |
| `new_contributors` | `users.created_at` | Users created in the period |
| `cp_distributed` | `reward_entries.created_at` | CP actually distributed in the period, per (contributor, challenge), broken down by `rule_key` |

Out of scope on purpose: evaluation runs, meeting analyses, leaderboard movements. The digest reports facts, not analysis. Slack signal awards already show up in `cp_distributed` under their own `rule_key`.

### Why the fifth section exists

The first four are **sections of appearance** — they only ever see an object once. A `project` contribution created in week 1, re-evaluated in week 4 for another 200 CP, appears only in week 1's digest, where it was worth almost nothing. On a `code` challenge, where iterating and relaunching the evaluation *is* the workflow, that can be most of the activity.

`reward_entries` is the only source that is **uniform across all four contribution types and immutable**: append-only, `created_at NOT NULL`, never rewritten. An improved model writes its delta there, a validation verdict its row, a Slack signal its own.

The two do not overlap and never double-count: `new_contributions` says what appeared, `cp_distributed` says where the points went.

> A contribution created at the very end of a period and evaluated after generation shows up with 0 CP in `new_contributions`. The next digest catches it through `cp_distributed`.

### Why `submitted_at` is not the filter

`contributions.submitted_at` means **last submission**, and inconsistently so:

| Contribution type | `submitted_at` on re-submission |
|---|---|
| `project` (code) | rewritten — `code-rewards.service.ts` |
| `dataset` / `model` / `api_packaging` (ML) | frozen — the ML workspace update does not touch it |
| `discussion` (Slack) | frozen — created once, the reward grows each cron run |
| `validation` | frozen — created once, the reward grows with each verdict |

It also carries a second responsibility: `lineage.ts` compares `submitted_at` to decide who submitted an artifact first, which decides who receives reuse credit. Rewriting it on ML re-submission would cost the original author their seniority — a reward bug. Hence a separate `created_at`, and the ledger for everything else.

### Groups

A group contribution carries `contributions.user_id = the holder`; the real shares live in `contribution_members` (see [`challenge-groups.md`](./challenge-groups.md)).

The digest lists **every member**, holder first, and reports the **group's global reward** — not an individual share. A contribution with no `contribution_members` rows is solo, which is the normal case rather than an anomaly.

### Snapshot semantics

The payload stores **denormalized data** (names, titles, CP amounts as they were at generation time), not just IDs. Digests are historical records: if a contribution is later deleted, a reward cache is rebuilt by `db-resync-rewards` on deploy, or an account is merged by `POST /api/users/merge`, past digests stay readable and keep reflecting what actually happened during their period.

A digest is **never regenerated or updated** after creation. `DigestRepository` deliberately has no `update` and no `delete`.

---

## Scheduling model

There is no dynamic cron schedule. The cron runs daily (same pattern as `slack-signals`); the decision to generate lives in the endpoint:

```
period_end of last digest  =  cursor
if whole UTC days since cursor >= digest_frequency_days  →  generate over [cursor, now]
else                                                     →  no-op
```

The `digests` table is its own cursor — no "last generated" field in `app_settings`, and no possible gap or overlap between two consecutive digests. The first digest ever uses the configured frequency as a lookback window (`[now - frequency, now]`).

### Whole days, not timestamps

The elapsed time is compared on **UTC day boundaries**. Comparing exact timestamps makes the schedule drift: a `period_end` stamped at 06:00:03 and a cron firing at 06:00:00 seven days later are 6 d 23 h 59 min 57 s apart, so the run would no-op and the digest would slip a day — every cycle, until a "weekly" digest lands on a different weekday.

The window bounds themselves stay exact timestamps: `period_start` equals the previous `period_end` with no rounding. That is what keeps consecutive digests from gapping or overlapping.

### Manual generation

The **Generate now** button calls the same generation path, skipping only the frequency check. By default it generates over `[last period_end, now]` like any other run, so the cursor invariant holds: the next automatic digest starts where the manual one ended. A manual digest with a very short period is valid and may have mostly empty sections.

It works even when `digest_enabled` is off — the toggle governs the cron, not the button.

**Choosing the start.** The tab also exposes a date field next to the button. Left empty, the cursor is used. Set, it forces `period_start` and **deliberately breaks the `period_start = previous period_end` invariant** — the resulting digest can overlap a period an earlier digest already covered.

That escape hatch exists because the invariant has a sharp edge: a digest generated over an empty or mistaken window still consumes the cursor, which would otherwise make the period before it unreachable forever. `period_end` is always `now`, so the cursor itself stays sound and the next automatic digest still starts from here.

A plain `YYYY-MM-DD` is read as **midnight UTC**, not midnight in the reader's time zone — otherwise the bound would drift from one browser to the next for a field that carries no time. A start that is not strictly before the end is refused (`400`).

---

## Configuration

Two fields on the `app_settings` singleton, edited from the Digest tab:

| Field | Purpose |
|-------|---------|
| `digest_enabled` | Master switch — when off, the cron no-ops (manual generation still works). Defaults to `false`: an admin feature does not turn itself on for existing instances. |
| `digest_frequency_days` | Interval between automatic digests (default `7`, accepted range 1–365) |

---

## Database

| Table | Purpose |
|-------|---------|
| `digests` | One row per generated digest: `uuid`, `period_start`, `period_end`, `generated_at`, `trigger_source` (`cron` / `manual`), `payload` (jsonb, the five sections) |

`period_start` equals the previous digest's `period_end`, unless a manual generation forced another start (see [Choosing the start](#manual-generation)).

Three datation columns were added elsewhere for the digest to be computable at all — `challenges.created_at`, `challenges.closed_at` and `contributions.created_at`. See [`database.md`](./database.md). `closed_at` is stamped by `ChallengeRepository.update()`, the single point both closing paths go through; it is re-stamped if a reopened challenge closes again, and cleared if a completed challenge reopens.

---

## API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/admin/digests` | List digests, newest first. Paginated (`?limit=`, `?offset=`), ships counts rather than payloads. | Admin |
| `GET` | `/api/admin/digests/:id` | Read one digest's full payload. | Admin |
| `POST` | `/api/admin/digests/generate` | Manual generation. Optional body `{ period_start }` (ISO or `YYYY-MM-DD`, read as midnight UTC, must be in the past) forces the lower bound; without it the cursor is used. | Admin |
| `PATCH` | `/api/admin/digest-settings` | Update `digest_enabled` / `digest_frequency_days`. | Admin |
| `GET` | `/api/cron/digest` | Daily check + generation when due. | `Bearer $CRON_SECRET` |

Nothing changes in `proxy.ts`: writes under `/api/**` already require `admin` by the blanket rule. The two `GET`s are not covered by that rule and re-check the role themselves.

The cron endpoint follows the existing pattern: secured by `CRON_SECRET`, declared in `vercel.json`, or curled by an external scheduler on Scalingo / PM2 (see [`deployment.md`](./deployment.md#cron-jobs)).

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/digest
```

---

## UI

A **Digest** tab on the admin profile page (`/contributors/me`), alongside Appearance / Integrations / Evaluation Grids / Modules / Onboarding:

- the enable toggle and the interval field;
- **Generate now**, disabled while a generation is in flight;
- the history, newest first, each entry expandable onto its five sections. An empty section renders an explicit "Nothing in this period" line rather than disappearing — a short digest is a valid result, and a missing section would read as a bug.

---

## Limitations (v1)

- **Dates predating the UTC fix are two hours off.** Columns are `timestamp` without a time zone, and were filled from two references until the connection was pinned to UTC (`packages/database-service/db/drizzle.ts`): `defaultNow()` wrote server-local time, Drizzle wrote UTC. Rows written before that keep their local-time lead, so a digest covering that stretch of history places them wrong. Anything written since is consistent.
- **No concurrency guard.** Two simultaneous generations (two admins, or a manual click while the cron runs) would read the same cursor and produce two overlapping digests. The disabled button is client state only. A unique index on `period_start` would close it — deliberately not built.
- **No catch-up window.** Disabled for three months then re-enabled, the next digest covers three months in a single payload. That is consistent with the "no gaps" invariant and accepted as is.
- **No retention.** Digests accumulate, one row per period. Purging is a later decision.
- **`db_data/seed.ts` does not clear `digests`** (the table has no FK), so a local re-seed leaves digests pointing at regenerated data. Harmless — the payload is frozen — but surprising locally.
- **Challenges closed before this feature shipped** have no `closed_at` and will never appear in `completed_challenges`.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/services/digest/digest-schedule.ts` | `isDigestDue()` / `digestWindow()` — the cursor and the day-boundary comparison. Pure |
| `packages/services/digest/digest-payload.ts` | `buildDigestPayload()` — the five sections, group resolution, ledger aggregation. Pure |
| `packages/services/digest/digest.service.ts` | Windowed queries, lookups, insert |
| `packages/services/digest/cron-digest.ts` | Enabled check + frequency check + generation |
| `packages/database-service/repositories/digest.repo.ts` | `digests` reads and the single insert |
| `packages/database-service/repositories/challenge.repo.ts` | `closedAtPatch()` + the windowed reads |
| `apps/leaderboard-client/src/app/api/cron/digest/route.ts` | Cron entry point |
| `apps/leaderboard-client/src/app/api/admin/digests/` | List / read / generate routes |
| `apps/leaderboard-client/src/app/api/admin/digest-settings/route.ts` | Settings endpoint |
| `apps/leaderboard-client/src/components/contributor/DigestTab.tsx` | The profile tab |

> Design decisions and what was rejected: [`docs/input/spec-digest.md`](./input/spec-digest.md).
