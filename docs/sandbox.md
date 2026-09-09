# Sandbox

The Sandbox is where anyone can **propose** a unit of work in the health domain, without approval. The community reacts with **stars**, crossing star milestones pays the author in CP, and an admin can **promote** the best proposals into official challenges.

It turns the leaderboard from a task board — where MyTwin defines the work and contributors execute it — into a two-way platform.

**Requires:** nothing beyond the database for the listing and stars. The formative evaluation needs the same GitHub and OpenAI connections as a code challenge.

**Reference documents:** [`input/spec-sandbox.md`](./input/spec-sandbox.md) (functional spec, its section 0 lists the arbitrated trade-offs and wins on contradiction) and [`input/plan-sandbox.md`](./input/plan-sandbox.md) (implementation plan).

---

## Concept

A sandbox is **not a challenge** and deliberately shares nothing with one:

| | Challenge | Sandbox |
|---|---|---|
| Who works on it | any member who joins | the author, alone |
| CP pool | yes | none |
| Tasks, teams | yes | none |
| Lifecycle | draft → active → completed | `open` → `promoted` / `archived` |
| Community input | contributions | stars only |

A sandbox has a **type** — `code` or `ml`, chosen at creation and immutable. `validation` is excluded: a validation challenge derives from an existing ML challenge, it cannot be born from a proposal. The type drives the expected inputs, and the type of the challenge it becomes if promoted.

Collaboration is deliberately blocked before promotion. Other contributors cannot join a sandbox; they star it. Collaboration starts once it becomes a challenge.

---

## Data model

### `sandboxes`

| Column | Notes |
|---|---|
| `uuid` | PK |
| `user_id` | the author, sole editor |
| `type` | `code` / `ml`, immutable after creation |
| `title` | |
| `context`, `goals`, `why` | the three sections of the proposal. `goals` is a `jsonb` string array rather than a markdown list, because each goal is rendered on its own and they are the natural candidates for the challenge's tasks after promotion |
| `repo_url` | required for both types |
| `model_url` | `ml` only, optional — a sandbox can start without an artifact |
| `dataset_urls` | `ml` only, `jsonb` string array, at least one required. An array because an ML challenge already stores `workspace_meta.datasetUrls[userId]` this way, so promotion pre-fills without conversion |
| `status` | `open` / `promoted` / `archived`. Created directly as `open` |
| `promoted_challenge_id` | set at promotion, `ON DELETE SET NULL` — deleting the challenge must not erase the proposal that produced it |
| `evaluation`, `evaluation_status`, `evaluated_at` | latest formative evaluation, same shape as a contribution's so the display is shared |

The evaluation lives **on the row**, not in `contributions`: it is formative, it pays nothing, and it must touch neither the ledger nor the leaderboard.

### `sandbox_rewards`

The sandbox CP ledger, **separate from `reward_entries`**.

`reward_entries.challenge_id` is `NOT NULL` with a FK to `challenges`, and the whole leaderboard aggregates it per contribution. Even `slack_signal`, the "out of pool" precedent, goes through a `challenge_id` and a `discussion` contribution. A sandbox has neither, and has no business simulating them.

| Column | Notes |
|---|---|
| `rule_key` | `star_tier` or `promotion` |
| `tier_stars` | the threshold crossed, `star_tier` only |
| `points` | |
| `user_id` | the author at payment time, denormalised so the leaderboard reads CP without a join |

Idempotence is carried by two **partial** unique indexes:

- `(sandbox_id, tier_stars) WHERE rule_key = 'star_tier'` — a milestone is paid once per sandbox, so star/unstar cycles can never pay twice, and a milestone once paid is never taken back if the count later drops;
- `(sandbox_id) WHERE rule_key = 'promotion'` — a sandbox is promoted, and paid, once.

They are partial because `tier_stars` is NULL for a promotion: a plain unique index would block nothing, Postgres treating two NULLs as distinct.

There is **no cached total** — no equivalent of `contributions.reward`. A contributor's sandbox CP is always a live `SUM(points)`. Two consequences: nothing to add to `scripts/db-resync-rewards.ts`, and deleting a row *is* the CP clawback.

### Settings

Two columns on the singleton `app_settings` row, both inert by default so the feature pays nothing until an admin configures it:

- `sandbox_star_tiers` — `jsonb`, ordered list of `{ stars, cp }` with strictly increasing thresholds;
- `sandbox_promotion_bonus_cp` — integer.

---

## Star tiers economy

Stars are not decoration — they are the platform's demand signal, and crossing a milestone credits the author.

The admin defines an ordered list of milestones, as many as they want, plus a promotion bonus:

```json
{ "tiers": [ { "stars": 5, "cp": 50 }, { "stars": 15, "cp": 100 }, { "stars": 50, "cp": 300 } ],
  "promotion_bonus_cp": 200 }
```

**Tiers, not a per-star rate.** Paying per star would make farming linear and worthwhile; a milestone crossed once is worth a fixed amount and nothing more.

**Paid once, never taken back.** Each crossed threshold writes one `sandbox_rewards` row, out of any pool. Unstarring reverses nothing: the count goes down, paid milestones stay paid. This is what makes star/unstar cycles pointless.

**Concurrency.** Two stars crossing the same threshold at the same moment both see the count as sufficient. What resolves them is not a lock but the partial unique index: each call reads the count after its own insert, then `insertTierIfAbsent` returns `null` when the row already exists. Exactly one payment per `(sandbox, threshold)`, whatever the interleaving.

**Reconfiguration.** Lowering a threshold below a sandbox's current count does not pay it retroactively — it is paid on the next star. Deliberate: saving a settings form should never trigger a wave of payments.

**One caveat for the UI.** `tierProgress` computes "all milestones reached · N CP paid" from the configured tiers, not from the ledger. If an admin has deleted a reward row after an abuse cleanup, that total is optimistic — the panel should sum the thresholds actually paid rather than trust the hint.

---

## Stars, identities and abuse controls

**Anyone can star, signed in or not.** This is what will later allow liking a sandbox straight from a newsletter email. Anonymous stars count and pay milestones exactly like account ones. The author cannot star their own sandbox.

### Two identities, two partial unique indexes

`sandbox_stars` carries both. A star made while signed in always writes `user_id`; an anonymous one writes the `anon_id` held by a signed cookie. Uniqueness is therefore two partial unique indexes rather than a composite primary key, which tolerates no NULL:

```
UNIQUE (sandbox_id, user_id) WHERE user_id IS NOT NULL
UNIQUE (sandbox_id, anon_id) WHERE user_id IS NULL
```

The second is partial on `user_id IS NULL`, not on `anon_id IS NOT NULL`: an attached row keeps its `anon_id` as an audit trail, and two successive attachments from the same browser must be able to coexist on one sandbox.

### Unstarring is a soft delete

A paid milestone is never taken back, so a star → unstar wave has to leave something the audit can read. `removed_at` keeps the row, the rate limit keeps counting on `created_at`, and the public counter reads only `removed_at IS NULL`. One identity never holds more than one row per sandbox: starring is an `INSERT … ON CONFLICT DO UPDATE SET removed_at = NULL`, so re-starring revives the row instead of creating a second one.

### The cookie carries uniqueness, the IP only carries rate limiting

`sb_anon` is a JWT signed with the same secret as the session, holding a random id, valid a year, `httpOnly`. It is issued **only** when starring, never on a read, so a plain reader is never given a cookie.

The IP is stored as an HMAC — never in clear — and serves **only** to cap the rate (30 anonymous stars per hour). Making it carry uniqueness would have been a mistake: a campus or a company leaves through a single address, so real users would block each other. The 429 message invites signing in, which is the way out for someone genuinely behind a shared IP.

**GDPR:** server-side salt, hashes purged after 30 days by an opportunistic update on every star write — no extra cron. `anon_id` is a random value with no link to a person and is kept. No user agent is stored.

### Signing in attaches anonymous stars

On sign-in, the anonymous stars held by the cookie are reassigned to the account, in one transaction that **deletes before it migrates** — otherwise the `(sandbox_id, user_id)` index would be violated. Two rows are deleted rather than migrated: when the account had already starred that sandbox, and when the account turns out to be the sandbox's author.

The attachment therefore **never raises** a counter, and lowers it by one per conflict resolved. A counter can consequently drop back below a threshold that was already paid — a normal, expected state, since a milestone is never taken back.

**Consequence on the API:** "milestone paid" can no longer be derived from the counter. The public view exposes the list of thresholds actually paid, read from `sandbox_rewards`; the counter is only used for progress toward the next one.

### After attachment, an anonymous identity no longer sees the account's stars

The cookie is kept — clearing it would produce a fresh identity on the next anonymous star, so more duplicates, not fewer. But an anonymous lookup only considers **unattached** rows (`user_id IS NULL`). Once a star belongs to an account, it becomes invisible and untouchable to the anonymous identity of the same browser.

What this guarantees: **nobody can unstar an account's stars without being signed in to that account**, which covers the shared machine — a lab, a family computer.

What it costs: someone signed out on their own browser sees "not starred" on a sandbox they had starred, and can star it again — one duplicate, bounded by the rate limit and by having to be signed out. The trade-off is deliberate in that direction: better to count one star too many than to let someone erase one that is not theirs.

### Audit and clawback

Since milestones are never reverted automatically, a fraudulent wave has to be undoable by hand: admin routes list a sandbox's stars grouped by origin, hashed IP and day, delete them by id, by hashed IP or by time window, and delete a reward row — which lowers the leaderboard total immediately, there being no cache.

One thing to know: if the counter is still above a threshold after cleanup, the milestone will be **paid again on the next star**. The unique index prevents duplicates, not re-creation — and at that point the milestone is legitimate.
---

## Reading CP back

Sandbox CP count in the ranking, and they get there through **one injection point**: `aggregateUsersByContribution()` in `lib/leaderboard.ts` takes the sandbox ledger as an optional argument and adds it to the totals **without touching the contribution counts** — the treatment already given to `discussion` CP, since a crossed milestone rewards a proposal rather than adding a contribution.

| Path | What it reads |
|---|---|
| `fetchLeaderboard` | the whole ledger, injected into the aggregation |
| `fetchContributorProfile` | the same for the global rank, plus this user's rows for `totalCP` and the Sandbox block |
| `fetchHomeOverview` | the same, and the "CP distributed" stat — without it the podium would show more CP than the global figure |

Two rules worth knowing:

- **A project filter drops them wholesale.** A sandbox has no project, so none can belong to the one being looked at; including them would inflate a contributor's total with CP earned outside the requested scope.
- **A time filter applies to `created_at`** on the reward row, like any other ledger entry.

`contributionShare` is per challenge and is left untouched — a sandbox has no pool to take a share of.

There is no cached total anywhere, so the numbers are always live and deleting a reward row is the clawback.

---

## In the digest

Two distinct decisions, easy to confuse:

- **Sandbox CP stay out of `cp_distributed`**, which aggregates per `(user, challenge)` from `reward_entries`. A sandbox has no challenge to aggregate under.
- **New sandboxes get their own section**, listing those created in the period with their author and star count. The payload moved to **version 2** for it.

Already-generated digests are immutable, so the tab renders the section only when the key is present rather than claiming an empty period on a v1 payload. The star count in that section is a snapshot taken at generation time — the one figure in the payload that is not windowed.

---

## UI

**Navigation.** Sandbox replaces About in the main navigation. The `/about` route is kept and is now reached from the home hero, through the same "see all" link style the rest of the home page uses — its arrow lives in `components/home/ArrowIcon.tsx` rather than being repeated in each component.

**Listing** (`/sandbox`) — search over title, author and context; sort by stars or recency; `Open` / `Promoted` / `Mine` pills with counts; header stats. A promoted card's call to action links to the challenge it became, not back to the sandbox. An archived sandbox appears only under `Mine`, and only for its author.

**Detail** (`/sandbox/:id`) — the three sections of the proposal, the repo and model links, the star toggle, the milestone panel, and for the author the formative evaluation panel. Editing and archiving live here too.

**Creation** — type first, then the fields that type needs. The "Start from a dev kit / SOON" row is a deliberate placeholder: no logic behind it, it marks where the dev-kit selector will slot in.

Two things the components must respect:

- **Milestones are read from `paid_tier_thresholds`**, and the "CP paid" total is summed from those thresholds — never from the progress hint, which sums the configured tiers and reads optimistically after an abuse cleanup.
- **Both pages fetch `/api/contributors/me` first**, and query the sandbox routes only once that resolves. Those routes sit outside the proxy matcher, so nothing else renews an expiring session; without this, a signed-in reader with a stale token would silently read as anonymous.

**Theme.** The design mock is light-themed and the app is token-driven, so colours are translated rather than copied — see the mapping table in [`input/plan-sandbox.md`](./input/plan-sandbox.md). The pages follow light and dark like everything else.

**Admin tab.** A "Sandbox" tab on `/contributors/me` holds the tier rows, the promotion bonus, and the star audit — see [`admin-settings.md`](./admin-settings.md).

---

## API and visibility

The listing and the detail pages are **public**. Creating, editing, evaluating, archiving and promoting all require an account — see the role table in [`auth.md`](./auth.md) and the routes in [`api.md`](./api.md).

`/api/sandboxes/**` sits deliberately **outside the proxy matcher**, like `/api/admin/*`: its writes are open to anonymous visitors, which no proxy exception can express, so each handler authenticates itself. One consequence: no silent token refresh runs there, and an expired session would read as anonymous. The sandbox pages fetch `/api/contributors/me`, which *is* in the matcher, and that is what refreshes the session.

`lib/public/sandbox.ts` is the single place where a field is added or withheld. The evaluation score goes to the author and admins only; an author is reduced to the three fields a card shows, never their email or GitHub handle; and no `ip_hash` or `anon_id` ever leaves the admin audit route, which itself only exposes a 12-character prefix of the hash.
