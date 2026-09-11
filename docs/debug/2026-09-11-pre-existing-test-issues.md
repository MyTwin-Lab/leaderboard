# Four pre-existing issues, parked

**Found:** 2026-09-11, while fixing the root Vitest configuration before
implementing `docs/superpowers/plans/2026-09-11-join-group-invitations.md`.

**None of these are caused by the join/notifications work.** They were invisible
until the root `vitest.config.ts` landed, because the 128 test files under
`apps/leaderboard-client` were never collected from the repo root — they failed
to resolve the `@` alias, and Vitest reported them as `(0 test)` rather than as
failures.

Status: **parked by decision**, not fixed. Recorded here so they are not
rediscovered from scratch.

---

## How this became visible

`npm test` at the repo root ran with **no configuration at all**. The `@` alias,
the `setupFiles` and the `server-only` mock all live in
`apps/leaderboard-client/vitest.config.ts`, so any test importing `@/lib/auth`,
`@/lib/db` or `@/lib/challengeBrief` — directly or through the module under
test — died at collection.

The symptom was misleading: `13 failed | 141 passed`, with **1293 tests passed
and 0 failed**. Thirteen files that never ran, reported as failures with no
failing assertion.

After adding the root config, collection went from **1293 to 1383 tests**, and
four genuine failures surfaced. Three were stale fixtures and are fixed. The
others below are not. A fourth, unrelated to Vitest, was found while applying
the new migration.

---

## 1. A project filter pads the leaderboard with zero-CP contributors

**Severity:** user-visible. This is the one worth looking at first.

**Verified against the running app, not only in test:**

```
GET /api/leaderboard?projectId=3905d71d-c2b0-4492-b27b-5aebfcd6c063
→ 22 entries, 19 of them at totalCP: 0
   (Akralan _, Alix Chagot, Asmaa Khaled, …)
```

Every contributor who has never touched the project is ranked into it at zero.

`api/leaderboard/route.test.ts` → `filters by projectId` asserts the opposite:
one entry, the only contributor credited on that project. The test was written
before the current behaviour.

**Open question:** is this a regression in `aggregateUsersByContribution`
(`lib/leaderboard.ts`), or a deliberate "show everyone, ranked" choice? It
cannot be decided from the code alone — it is a product call, and it is easier
to judge on the rendered leaderboard page than in a diff.

**The test is currently left failing on purpose**, so whichever way the decision
goes, it is the one that gets updated rather than quietly forgotten.

---

## 2. A malformed `projectId` returns 500 instead of 400

**Severity:** small, but it renders a client error as a server error.

`leaderboardQuerySchema` validates `projectId` as a UUID. `parseSearchParams`
throws a `ZodError`, which reaches the generic `catch` in
`app/api/leaderboard/route.ts`:

```ts
if (error instanceof ProjectNotFoundError) {
  return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
}
console.error("[GET /api/leaderboard]", error);
return NextResponse.json({ error: "Failed to compute leaderboard" }, { status: 500 });
```

So `?projectId=not-a-uuid` → **500**, while `?projectId=<well-formed but
unknown uuid>` → 400. The 400 path exists only for the second case.

**Suggested fix, when someone takes it:** catch `ZodError` in the same block and
return 400. Worth checking whether other routes using `parseSearchParams` have
the same hole — the helper is shared.

---

## 3. `repo-activity/route.test.ts` — shape mismatch in the mock

**Severity:** test-only as far as could be established. Not diagnosed to
completion.

```
FAIL src/app/api/challenges/[id]/repo-activity/route.test.ts
  > returns activities keyed by repo_id with github type
AssertionError: expected undefined to be 'github'
```

`body.activities['repo-1']` **is** defined — only its `type` is missing, which
points at the route having returned the `{ error: string }` branch rather than a
`RepoActivity`.

What was established:

- the route builds its connector input as
  `{ ...repo, type: repo.repo_type, external_repo_id: repo.repo_external_id }`;
- the test double returns `external_repo_id: 'owner/repo'` but **no**
  `repo_external_id`, so that field lands `undefined`;
- the `ConnectorRegistry` mock returns a connector unconditionally, so the
  `!connector` guard should not be what fires.

Which leaves the failure unexplained by inspection alone — it needs a run with
the error branch instrumented. Not pursued: unrelated to the work in flight, and
guessing further would have been guessing.

---

## What was fixed at the same time (for contrast)

All three in `app/api/leaderboard/route.test.ts`, all stale fixtures:

- `fetchLeaderboard` gained two reads — `contributionMember.findAll()` and
  `sandboxReward.findAll()` — from the groups and sandbox features. Unmocked,
  they reached a real Postgres client and the route answered 500. Stubbed once
  in a `beforeEach` rather than per-case, so a third ledger added later does not
  break three tests at once.
- `projectId` fixtures `"p1"` / `"p2"` predate the UUID validation and now fail
  the schema. Replaced with well-formed UUIDs.
- `"All projects"` became `"All Projects"` in the copy.

---

## 4. `db:apply-schema` aborts on a fresh database

**Found:** while applying the `notifications` DDL (Task 1 of the join plan).

`scripts/db-apply-schema.ts` stops at its 14th statement:

```
✓ idx_tasks_challenge_user
❌ ALTER TABLE tasks ALTER COLUMN type DROP NOT NULL
   → la colonne « type » de la relation « tasks » n'existe pas
```

`tasks.type` no longer exists in the Drizzle schema, so a database created by
`drizzle-kit push` does not have it. The statement targets legacy databases
where the column is still there — which is presumably true of production, and
is why this has never been noticed.

**Why it matters beyond cosmetics:** the script has **no per-statement error
tolerance**. One failing statement aborts the run, so every statement after it
is skipped — including everything appended later. The `notifications` DDL sits
at the end of the array and is therefore unreachable on any database where an
earlier statement fails.

On a fresh local database this is harmless: `drizzle-kit push` has already
created the table and its four indexes (verified). It is the **deploy** path
that is fragile.

**Two candidate fixes, not applied:**

- guard the statement — `ALTER TABLE tasks ALTER COLUMN type DROP NOT NULL`
  only `IF EXISTS`, in a `DO $$ ... $$` block;
- or make the runner log and continue on error rather than abort, which is the
  behaviour the file's own header implies ("idempotent, pensé pour tourner à
  chaque déploiement").

The second changes deploy behaviour and should be a deliberate decision, not a
side effect of adding a table.
