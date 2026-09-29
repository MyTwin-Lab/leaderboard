# Sandbox

The Sandbox is where anyone can **propose** a project in the health domain, without approval. The community reacts with **stars**, crossing star milestones pays the author in CP, and an admin can **promote** the best proposals into official projects, each opening with its first challenge.

It turns the leaderboard from a task board — where MyTwin defines the work and contributors execute it — into a two-way platform.

**A sandbox is a project, not a challenge in waiting.** What you deposit is an idea: a title, a context, goals, a why. No type, no repository, no dataset, no model — and no formative evaluation. Those were the vocabulary and the machinery of a challenge; they are created at promotion, on the challenge, not before.

**No self-serve creation from the listing.** The "Create your sandbox" strip at the bottom of `/sandbox`, `/challenges` and `/leaderboard` books a call with the team (`/book?for=project`, see [`booking.md`](./booking.md)) for everyone, signed in or not. `POST /api/sandboxes` and `CreateSandboxModal` are unchanged; the modal is only mounted on a sandbox's detail page, for editing. An admin creation screen is on the booking TODO.

It is a product **module** (`modules/sandbox`), **enabled by default**, that an admin can turn off from the Modules tab of `/contributors/me` (see [`admin-settings.md`](./admin-settings.md)). Its star tiers and promotion bonus are the module's settings.

**Requires:** nothing beyond the database.

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

A sandbox has **no type**. `code` / `ml` decides which repos get created and which grid scores them — that is a challenge decision, and it is taken by the admin in the promotion drawer, not by the author at deposit time. (`validation` is excluded there too: a validation challenge derives from an existing ML challenge, it cannot be born from a proposal.)

Collaboration is deliberately blocked before promotion. Other contributors cannot join a sandbox; they star it. Collaboration starts once it becomes a challenge.

---

## The module

**Disabled** means gone, not hidden: `/api/sandboxes/**` and the sandbox admin routes answer 404, the `/sandbox` pages call `notFound()`, and the "Sandbox" entry of the public navigation disappears (the `publicNav` slot of `distribution/modules/sandbox.tsx`, rendered by the navbar and the footer). Existing proposals, stars and sandbox CP are kept.

The module declares its settings schema (`modules/sandbox/settings.ts` — the star tiers and the promotion bonus, edited from the Modules tab), its CP source (the `sandbox_rewards` ledger) and the daily job `sandbox.ip-hashes.purge`. No flow declares anything for the sandbox: a proposal is an idea, and the admin chooses the challenge's flow at promotion.

---

## Data model

### `sandboxes`

| Column | Notes |
|---|---|
| `uuid` | PK |
| `user_id` | the author, sole editor |
| `title` | |
| `slug` | the public URL segment, `/sandbox/<slug>`. Unique among sandboxes, derived from the title at creation, editable by the author; a former slug keeps redirecting (`sandbox_slug_redirects`). See [`seo.md`](./seo.md) |
| `context`, `goals`, `why` | the three sections of the proposal. `goals` is a `jsonb` string array rather than a markdown list, because each goal is rendered on its own. At promotion the three become the brief of the first challenge (`buildPromotedBrief`) |
| `cover_image_url` | the card illustration, set by the author; it follows the proposal to the challenge on promotion |
| `status` | `open` / `promoted` / `archived`. Created directly as `open` |
| `promoted_challenge_id` | set at promotion, `ON DELETE SET NULL` — deleting the challenge must not erase the proposal that produced it |

**What the table no longer holds**, dropped by migration `0025_sandbox_project.sql`: `type`, `repo_url`, `model_url`, `dataset_urls`, and the three evaluation columns. A proposal is an idea, not a half-built deliverable; the formative evaluation scored a GitHub repository on the `code` grid, which is to say it read a proposal as a challenge. What carries a project here is its stars.

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

The module's settings live in `module_settings.settings` for the `sandbox` key, validated by `sandboxSettingsSchema`. Both are inert by default so the feature pays nothing until an admin configures it:

- `star_tiers` — ordered list of `{ stars, cp }` with strictly increasing thresholds;
- `promotion_bonus_cp` — integer.

They were copied from the former `app_settings.sandbox_*` columns, which are no longer read and are dropped in challenge 020, L7.

---

## Star tiers economy

Stars are not decoration — they are the platform's demand signal, and crossing a milestone credits the author.

The admin defines an ordered list of milestones, as many as they want, plus a promotion bonus:

```json
{ "star_tiers": [ { "stars": 5, "cp": 50 }, { "stars": 15, "cp": 100 }, { "stars": 50, "cp": 300 } ],
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

**GDPR:** server-side salt, hashes purged after 30 days — by an opportunistic update on every star write, and by the module's daily job `sandbox.ip-hashes.purge` (`modules/sandbox/retention.ts`) so that hashes do not outlive the announced period when nobody stars. `anon_id` is a random value with no link to a person and is kept. No user agent is stored.

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

Sandbox CP count in the ranking as a **CP source**: the module declares `cpSource`, the core reads every installed source (`packages/capabilities/economy.ts`), and `aggregateUsersByContribution()` in `lib/leaderboard.ts` adds them to the totals **without touching the contribution counts** — the treatment already given to `discussion` CP, since a crossed milestone rewards a proposal rather than adding a contribution.

| Path | What it reads |
|---|---|
| `fetchLeaderboard` | every CP source, added to the aggregation |
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

**Navigation.** Sandbox is in the main navigation as the module's `publicNav` entry — shown only while the module is enabled (`distribution/modules/sandbox.tsx`, rendered by the navbar and the footer through `ModuleNavLinks`). `/about` is gone with the redesign; the Lab's story lives on `/vision`.

**Listing** (`/sandbox`) — search over title, author and context; most-starred first; `Open` / `Promoted` / `Mine` pills with counts; header stats. Chaque carte porte l'image de couverture posée par l'auteur, ou une illustration de repli (`lib/coverImage.ts`). A promoted card's call to action links to the challenge it became, not back to the sandbox. An archived sandbox appears only under `Mine`, and only for its author.

The sort control is `TabPills`, the same component as the profile tabs, so its fill slides between sorts instead of jumping. Changing sort or filter remounts the grid so the cards replay their entry; search is deliberately left out of that key, or the list would flicker on every keystroke.

**Getting there.** `/challenges` ends with a banner pointing at the Sandbox — the twin of the leaderboard's own, which points at the challenges. One catches whoever is not ranked yet, the other whoever found no challenge that fits.

**Detail** (`/sandbox/:slug`) — built from `Sandbox Vitrine.dc.html`, in `components/sandbox/vitrine/`. A photo hero carrying the status, the title and the star button; "Why this sandbox exists" from `why`; "Who proposed this sandbox" on the dark card; then the proposal in a reading column with the star milestones sticky beside it. Editing, promoting and archiving sit in a discreet toolbar under the hero — the mock has no such controls, and putting them on the photo would have given them the same weight as the star.

Three gaps with the mock, all deliberate: the stat row on the photo and the three impact figures beside "Why this sandbox exists" are not rendered (the stars and milestones already live in the right column, and repeating them gave the same number twice), and the "Repository" card in the author section has nothing left to show.

The page reuses `challenge-vitrine.css` rather than restating it: the mock lays out the hero, the "why" section, the reading column and the aside exactly as `Challenge Vitrine.dc.html` does, so the root carries both `v-cd` and `v-sd` and only what is proper to the sandbox is written in `sandbox-detail-vitrine.css`.

**One toggle, two buttons.** The mock puts a star on the photo *and* in the right column. `useStarToggle` is mounted once in the page and both buttons share it — two hooks would each hold their own optimistic counter, and clicking one would leave the other behind.

**Creation** — a title, an address, a context, goals, a why, a cover. That is the whole form: no type selector, no repository, no dataset, no model. The **Address** field under the title shows the public URL: it follows the title until touched, is checked for availability as it is typed, and in edit mode says that the current address will redirect once changed. Creation and editing carry exactly the same fields; only the title, the HTTP verb and the caption differ.

Two things the components must respect:

- **Milestones are read from `paid_tier_thresholds`**, and the "CP paid" total is summed from those thresholds — never from the progress hint, which sums the configured tiers and reads optimistically after an abuse cleanup.
- **Both pages fetch `/api/contributors/me` first**, and query the sandbox routes only once that resolves. Those routes sit outside the proxy matcher, so nothing else renews an expiring session; without this, a signed-in reader with a stale token would silently read as anonymous.

**Theme.** The design mock is light-themed and the app is token-driven, so colours are translated rather than copied — see the mapping table in [`input/plan-sandbox.md`](./input/plan-sandbox.md). The pages follow light and dark like everything else.

Two traps `globals.css` sets, both of which caught these components before being fixed:

- **An opaque `bg-white` stays white in light mode.** The stylesheet only rewrites the *translucent* whites (`bg-white/<opacity>`) and `text-white*`. A solid white pill therefore disappears on a light page. Use `bg-foreground` / `text-background`, which swap with the theme — that is what `TabPills` does, and its own comment says so.
- **Light mode sets the colour of every `svg`.** An icon inside a dark-filled button renders dark on dark. An inline `style={{ color: "var(--background)" }}` beats that rule, which carries no `!important`.

**Admin.** The Sandbox card of the Modules tab on `/contributors/me` switches the module on or off and holds the tier rows, the promotion bonus and the star audit (`SandboxSettings`, saved through `PATCH /api/modules/sandbox`) — see [`admin-settings.md`](./admin-settings.md).

---

## No formative evaluation

There used to be one: the author could have their repository scored on the `code` grid, for zero CP, as a mirror of their own work and a quality read for an admin weighing promotion.

It is gone, with the repository and the type it needed. Scoring a GitHub repo on the `code` grid is reading a proposal as a challenge — and a proposal no longer carries a repo to read, nor a type to pick a grid from. `SandboxEvaluationService`, `POST /api/sandboxes/:id/evaluation` and the two panels that displayed it are deleted; the three columns went with migration `0025`.

What tells an admin a proposal is worth promoting is its stars.

---

## Promotion

An admin turns a convincing proposal into an official **project**, with its **first challenge**. A sandbox is a project, so promotion never attaches it to an existing one: it creates a new `projects` row, named after the proposal, with the author as `manager_id` — the per-project relationship that gives them the manage view of its challenges (see [`auth.md`](./auth.md)). The project's description is the proposal's context. There is no project to pick in the drawer.

The challenge is the admin's to shape. **The type is chosen here**: a proposal does not carry one, and `code` / `ml` decides which repos get created and which grid scores them. `validation` and `annotation` are not offered — a validation challenge derives from an existing challenge, an annotation challenge from a campaign. Everything else (pool, reward rules, dates, compute) is the admin's call too, filled in through the usual challenge drawer, pre-filled from the sandbox — the address included: the challenge takes the sandbox's slug when it is free among challenges, so `/sandbox/mykine` becomes `/challenges/mykine`.

**The three sections become the brief.** `context`, `goals` and `why` are composed by `buildPromotedBrief` in the shape of the brief skeleton: the context and the why under `## Context` (which the challenge vitrine reads as "Why this challenge exists"), the goals as the `## Objective` list. No `## Expected result` — a proposal has none, and an empty heading would look sloppy; the admin adds it in the drawer if they want one. The drawer opens with the brief pre-filled and editable; what is sent is what gets written, an emptied brief meaning no document. A promotion that arrives without a `brief` field (a script, the seed) gets the composed one. The challenge's `description` is only its short blurb, the proposal's context — the sections are not repeated there. The goals are **not** turned into template tasks.

The challenge is born as it would be from the creation route: its reward rules are read by the chosen flow (`parseFlowRules`), its configuration validated and stored in the flow's current version (`prepareFlowConfig` — `own_repo` for a code challenge, the compute extension for an ML one), its repos decided by the flow's `onCreate` hook (`creationRepos`). The promotion bonus comes from the module's settings.

### One transaction, guarded on the way in

```
UPDATE sandboxes … WHERE uuid = $id AND status = 'open' RETURNING   ← row lock, the concurrency guard
INSERT projects                  (the proposal's title and context, the author as manager)
INSERT challenges                (project_id = the new project)
UPDATE sandboxes SET promoted_challenge_id = …
INSERT repos + challenge_repos   (workspace_meta empty)
INSERT challenge_documents       (brief.md — skipped when the brief is empty)
INSERT challenge_teams           (the author, workspace pending)
INSERT sandbox_rewards { rule_key: 'promotion' }
```

The brief is written **inside** the transaction rather than posted afterwards by the drawer, as the creation route does: a promoted challenge without its brief would be a half-done promotion. The client sends the text in the body (`brief`), the service resolves it (`resolvePromotedBrief`) and writes the `brief.md` document under the shared `BRIEF_FILENAME` (`packages/database-service/domain/brief.ts`).

The guarded update comes **first**: a second concurrent promotion finds no row, throws, and rolls back. The unique `promotion` index on `sandbox_rewards` is the belt to that pair of braces.

The challenge id is set in a **later** statement rather than in the first one, because `promoted_challenge_id`'s foreign key is not deferrable — pointing at a challenge that does not exist yet would fail at statement end.

The promotion row is written **even when the bonus is zero**: it is the trace of the promotion, and the unique index rests on it.

### The author joins, with nothing pre-filled

The author is a member of their challenge from the moment it is promoted — no join required. Their workspace row is `pending`, exactly like anyone who has just joined an `own_repo` challenge: a proposal carries no repository, so there is nothing to pre-fill.

**Nothing is carried over any more.** Promotion used to copy the sandbox's repo, dataset and model into already-scored contributions, then run `MlRewardsService.award` on each. Those three fields no longer exist, so the whole path — `buildAuthorContributions`, `seedMlWorkspaceMeta`, `scheduleAuthorWork` and the `contributionRepo` / `awardMl` dependencies — is gone. The author submits from the challenge like everyone else, which also means promotion no longer fires an agent call.

The contribution titles and the artifact flag live in `ML_ROLE_RULE` (`packages/services/challenge/mlRoles.ts`), shared with the workspace action: two paths write these contributions now, and a carried-over one has to be indistinguishable from a submitted one.

### After promotion

The sandbox is marked `promoted` and linked to the challenge; its card in the listing points there. The project is reached through the challenge (`challenges.project_id`) — no second link on the sandbox. Other contributors join through the normal challenge flow; the author, as project manager, opens the next challenges of their project the usual way. The proposal itself is never deleted — deleting the challenge sets the link back to NULL rather than erasing what produced it.

---

## API and visibility

The listing and the detail pages are **public**. Creating, editing, evaluating, archiving and promoting all require an account — see the role table in [`auth.md`](./auth.md) and the routes in [`api.md`](./api.md). With the module disabled, every one of them answers 404.

`/api/sandboxes/**` sits deliberately **outside the proxy matcher**, like `/api/admin/*`: its writes are open to anonymous visitors, which no proxy exception can express, so each handler authenticates itself. One consequence: no silent token refresh runs there, and an expired session would read as anonymous. The sandbox pages fetch `/api/contributors/me`, which *is* in the matcher, and that is what refreshes the session.

`lib/public/sandbox.ts` is the single place where a field is added or withheld. The evaluation score goes to the author and admins only; an author is reduced to the three fields a card shows, never their email or GitHub handle; and no `ip_hash` or `anon_id` ever leaves the admin audit route, which itself only exposes a 12-character prefix of the hash.
