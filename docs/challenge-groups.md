# Working as a Group on a Challenge

Two or three contributors can take on a challenge together. They share one
workspace, produce one contribution, and split its reward — with a collective
bonus that makes the group worth more than the sum of its halves, but each
individual share smaller than going solo.

Groups are scoped to a single challenge. There is no persistent team: a group
forms when someone joins, and dies with the challenge.

---

## The model in one paragraph

A group **shares the workspace**, not just the credit. On a `code` challenge
that means one task board, one branch, one evaluation, one `project`
contribution. On an `ml` challenge, one dataset selection, one Kaggle model
URL, one packaging endpoint. Whoever acts — moving a card, submitting a
dataset, launching the evaluation — acts on the group's workspace.

This was a deliberate reversal of the first design, which shared only the
reward while leaving each member their own board. That version turned out to
be both more expensive to build and incoherent to pay out; see
[Why not just share the credit?](#why-not-just-share-the-credit) below.

---

## How ownership works

The codebase anchors ownership on `user_id` everywhere: `tasks.user_id`,
`contributions.user_id`, `challenge_teams`, `workspace_meta.userUrls[userId]`.
Adding a second axis — a `group_id` column on each of those — would have
doubled every query and every permission check.

Instead there is a single indirection:

```ts
resolveWorkspaceOwner(challengeId, userId) // → the holder's user_id
```

It returns the **group holder** when the caller belongs to a group, and the
caller themselves when they are solo. Everything downstream keeps working on a
plain `user_id`; it is simply the holder's instead of the caller's. A solo
participation therefore behaves exactly as it always has.

`packages/services/challenge/group.ts` exposes:

| Export | Purpose |
|---|---|
| `getGroupContext(challengeId, userId)` | holder, group id, member ids and multiplier, in **one** query |
| `resolveWorkspaceOwner(challengeId, userId)` | shortcut when only the ownership key is needed |
| `groupContextFrom(participants, userId)` | same resolution on a participant list already in hand |

The pure half — constants, the multiplier, holder selection — lives in
`groupPolicy.ts`, so the UI can import it: `group.ts` instantiates a
repository, hence a Postgres client, which must never reach a browser bundle.

### Who is the holder?

There is no "creator" column. The holder is the member whose `challenge_teams`
row carries the workspace, because only one member ever triggered the board
copy and the branch provisioning:

1. the member with a `workspace_ref` (provided-repo mode), else
2. the member with a `workspace_url` (own-repo mode), else
3. the lowest `user_id`.

The third rule covers the window where provisioning is still pending or has
failed. It is not *fair*, it is *deterministic* — which is what matters, since
two consecutive reads must never disagree on who the holder is.

### Where the resolver is wired

| Location | What it resolves |
|---|---|
| `api/tasks` (GET `scope=mine`, POST) | the board the caller works on |
| `api/tasks/[id]` | whose task it is |
| `api/tasks/[id]/details` | reports `board_owner_id` to the page |
| `api/challenges/[id]/workspace` | whose declared repo is being set |
| `api/challenges/[id]/ml-workspace` | `userUrls`, `datasetUrls`, contribution lookup |
| `api/challenges/[id]/overview` | reports `my_workspace_owner_id` |
| `code-rewards.service`, `ml-rewards.service`, `lineage` | whose contribution is scored |

The rule when reading this code: `session.userId` becomes the holder wherever
it is an **ownership key** (whose board, whose slot, whose contribution), and
stays the caller wherever it is an **identity** (manager checks, "am I on this
challenge", `created_by`, Slack signals). The test in case of doubt: *should a
co-member be able to see or change this thing?*

---

## Data model

### `challenge_teams.group_id` (nullable uuid)

Two rows of the same challenge sharing a `group_id` form a group. `null` means
a solo participation. Destroying a group is setting its `group_id` back to
`null`.

A **unique index on `(challenge_id, user_id)`** ships with it. The table never
had one, and the join does a non-transactional check-then-insert — a duplicate
row had in fact accumulated in production data, and had to be removed before
the index could be created (see `scripts/db-apply-schema.ts`).

### `contribution_members`

| Column | Notes |
|---|---|
| `contribution_id` | FK → `contributions`, cascade |
| `user_id` | FK → `users`, cascade |
| `share_cp` | this member's slice, **cumulative** |

A solo contribution has **no row at all**. The absence of members means "the
whole reward goes to `contributions.user_id`", which is what leaves the
historical behaviour intact with no data migration.

`share_cp` accumulates rather than replaces (`ON CONFLICT … share_cp +
excluded.share_cp`). Code scoring is iterative — the same contribution grows
across runs — and each run only knows the delta it just wrote to the ledger.
The consequence is the intended one: **a member who joins after a first run
only earns a share of what follows**, without anything having to be frozen.

The invariant that matters is `Σ share_cp = contributions.reward`. Break it and
the leaderboard stops adding up to what the challenge actually paid out.

### What did *not* change

`contributions` keeps `user_id` as the holder and `reward` as the group total.
`reward_entries` is untouched: the ledger stays at contribution level under the
holder's id, and the per-member division is carried solely by `share_cp`. No
ledger row per member.

---

## Reward

The multiplier is **`1 + 0.4 × (n − 1)`**, capped at a **group size of 3**.

| Size | Group earns | Each member keeps |
|---|---|---|
| 1 | 100 % | 100 % |
| 2 | 140 % | 70 % |
| 3 | 180 % | 60 % |

A group of three therefore costs the pool 1.8× where three solo contributors
would cost 3×. **A group is cheaper for the challenge pool, not dearer** — which
is what allowed a more generous coefficient than first proposed.

### Order of operations

The multiplier enters the **pure functions** (`computeCodeAward`,
`computeMlAward`) and scales the gross amount, so it lands before the iterative
delta and before the pool clamp. Both functions clamp row by row against a
decreasing pool; applying the bonus afterwards in the service would have broken
that accounting.

```
score → gross award → × group multiplier → clamp on remaining pool
      → ledger rows → split the run's delta → contribution_members
```

Shares are computed by `splitShares()` (`packages/evaluator/share.ts`) using
largest remainders, leftover to the holder, so the sum equals the awarded total
exactly — for negative totals too, since a ledger correction produces a
negative delta to distribute.

### The group bonus does not leak outside the group

On ML, reusing someone's dataset moves a slice of your award to its author.
That deduction is computed on the **un-multiplied** amount (`basePoints` on
`GrossAward`).

A third party earns a share of the value produced from *their artefact*. The
group bonus rewards working together, which that third party had no part in —
paying them 1.8× would leak an internal bonus outside the group. When the pool
clamps the award, `basePoints` shrinks by the same ratio, so nothing is ever
paid out on points that were never granted.

The take-the-lead bonus (`beat_best`), by contrast, **is** scaled like
everything else. Leaving it flat would mean a member of a trio keeping 60 % of
the ordinary rows but only 33 % of that one — two treatments for one award.

### Reuse inside a group

A non-issue by construction: `lineage.ts` detects reuse by comparing
`contribution.user_id`, and a group has a single contribution per step. You
cannot reuse your own artefact.

---

## Forming a group

The brief screen (shown to a signed-in contributor who has not joined yet)
carries two actions: **Join** and **Join as a group**.

```
Join as a group
   → POST /join { mode: 'group' }        creates group_id, copies the board,
                                          provisions the branch, returns the token
   → invite modal opens with the link

teammate opens /challenges/:id?group=<token>
   → GET /group/:token                   holder's name, size, joinable?
   → brief screen, single action "Join <name>'s group"
   → POST /join { group: <token> }       no board copy, no provisioning,
                                          branch reopened to every member
```

There is no invitation record, no pending state, no notification: **the link
is the invitation**. That is why the modal is the only place it appears, and
why a banner on the workspace brings it back later.

### Guard rails

- The link is valid only while the challenge is open and the group is not full.
- **A contributor who joined solo cannot switch to a group.** This is
  structural, not cautious: they already have a copied board and a provisioned
  branch. The brief says so up front rather than letting people find out too
  late.
- Groups are invisible: no listing of open groups, no acceptance mechanic. A
  group is reachable only through its link.
- The size cap is soft. The unique index closes the double-join, but two
  simultaneous `POST /join` can still overshoot by one. Locking that down would
  need a serialisable transaction for a three-person scenario.
- A member without a connected GitHub account cannot push to the branch. The
  join response reports them so the UI can say so immediately.

### Why the invite token is not on the overview

`group_id` **is** the invite link. Publishing it on the overview payload would
make every group joinable without ever having received one.

So the overview publishes `group_owner_id` — a `user_id` already visible in
`team`, which says who works with whom — and masks `group_id` for everyone but
its own owner. Reading an invite goes through a dedicated endpoint that answers
only on an exact token and lists nothing:

```
GET /api/challenges/:id/group/:token
  → { ownerName, size, maxSize, joinable, reason }
```

`reason` carries the same four barriers as the join (`challenge_closed`,
`already_member`, `already_solo`, `group_full`) so the screen can explain
itself instead of failing at the click.

---

## A shared board means concurrency

Until groups, two people never touched the same board, so the status PATCH
could write blind. It no longer can: if Bob moves a card to Done and Alice, on
a screen four seconds old, drags it from To do to In progress, her write would
silently overwrite his.

The client now sends the status it believes it is moving **from**, and the
repository adds it to the `WHERE` clause:

```sql
UPDATE tasks SET status = ? WHERE uuid = ? AND status = ?
```

Zero rows affected means someone got there first. The route answers **409**
with the real state, and the board undoes its optimistic move and says what
happened.

The status is the guard rather than a version number for two reasons: `tasks`
has no `updated_at` column, and the status is the disputed value anyway.
Sending `from_status` stays optional, so a client that omits it writes exactly
as before.

Freshness is handled separately and deliberately lightly: `refetchOnWindowFocus`
is re-enabled on the challenge overview query, which covers the real pattern —
nobody stares at a kanban, they come back to it after a detour through Slack or
their editor. **No polling was shipped.** Correctness is guaranteed by the
conditional write, not by refresh frequency, so an interval can be added the day
someone actually complains about staleness.

---

## Reading CP back

Four paths summed rewards by `contributions.user_id`, which on a group
contribution is the holder alone. All four now read `share_cp`:

| Path | What changed |
|---|---|
| `lib/leaderboard.ts` → `aggregateUsersByContribution` | splits by share **and** counts the contribution for every member |
| `lib/server/leaderboard.ts` → `fetchContributorProfile` | `findByUser` alone would show a co-member nothing of their own work |
| `lib/server/home.ts` | count and CP per member |
| `ParticipantsProgress` | one row per **board**, avatars stacked |

The contribution count is the easy one to forget: without it a co-member shows
CP and zero contributions.

Contributions carry their co-members' avatars in the manager view and on the
contributor profile, where the CP shown is that person's share rather than the
group total.

---

## Why not just share the credit?

The first design kept personal boards, branches and evaluations, and only
divided the reward. It was dropped for two reasons.

**It paid out wrong.** `alreadyAwarded` is indexed per user, so each member's
evaluation would have collected the fixed and quality amounts again. A group of
two would have drained 2.6× the pool for one delivery and paid **each** member
1.4× the solo award — a farm, and the exact opposite of a reduced individual
share.

**It was more work.** Sharing only the credit means merging, after the fact,
things produced separately: reconstructing a single row for the manager,
deciding what "freezing the composition" means across iterative runs, guarding
reuse between members. Sharing the workspace makes all of those disappear —
there is only ever one of each.

## Also rejected

- **A second `group_id` axis** on `tasks` / `contributions` — doubles every
  query and permission check for conceptual tidiness only.
- **Mirror contributions duplicated per member** — pollutes the list, breaks
  dedupe and reuse on ML challenges.
- **A persistent cross-challenge group** from the profile — too much lifecycle
  for a first version.
- **A contributor picker** to build the group — assumes you know who signed up,
  and the list can get long.
- **A short code to type** instead of a link — less fluid, same mechanics.
- **A public list of open groups** — would require an acceptance mechanic.
- **SSE / WebSocket for the shared board** — no realtime infrastructure exists
  in the project, and the payoff over the conditional write is marginal for a
  three-person board.

---

## Key files

```
packages/services/challenge/groupPolicy.ts   constants, multiplier, holder pick (pure)
packages/services/challenge/group.ts         resolver over challenge_teams
packages/evaluator/share.ts                  splitShares(), largest remainders
packages/database-service/repositories/contributionMember.repo.ts
apps/leaderboard-client/src/app/api/challenges/[id]/join/route.ts
apps/leaderboard-client/src/app/api/challenges/[id]/group/[token]/route.ts
apps/leaderboard-client/src/components/challenges/GroupInviteModal.tsx
```

The decision record — including the alternatives weighed and the open questions
at the time — lives in
[`docs/input/spec-groupes-challenge.md`](./input/spec-groupes-challenge.md),
with the sequencing in
[`docs/input/plan-groupes-challenge.md`](./input/plan-groupes-challenge.md).

## Open questions

- **Branch naming.** A group still gets `contrib/015-alice-dupont`, which is
  correct but misleading. `group/015-alice-dupont` would read better; purely
  cosmetic, but visible in the repo.
