# Sandbox — Contributor-Proposed Open Challenges

**Date:** 2026-09-08
**Status:** Design validated, ready for implementation
**Spec for:** Claude Code handoff

---

## 1. Pitch — what this adds and why it matters

Today, the leaderboard is a one-way street: MyTwin defines the challenges, contributors execute them. That covers what *we* need — but it caps the platform at the limits of our own imagination. The people building on the leaderboard — engineers, students, and soon patients and medical professionals — have their own ideas of what's worth building for health. Right now, those ideas have nowhere to live.

The **Sandbox** turns the leaderboard into a two-way platform, the way open source works: anyone can propose. A contributor deposits an open challenge — a title, a description, a repo (possibly a model too) — as long as it lives in the health domain. It doesn't need our approval to exist. It sits in the Sandbox, visible to the community, and the community reacts to it the simplest way possible: **stars**, exactly like GitHub.

Stars are not decoration. They are the platform's demand signal:

- They tell us what the community — including patients and doctors on the platform — actually wants to see built, rather than what we guess they want.
- They reward initiative directly: crossing star milestones earns the author Contribution Points, so proposing something people care about is itself a credited contribution.
- Tomorrow, they extend beyond the platform: a newsletter can showcase open challenges and collect likes straight from the email, giving us an even wider read on what resonates.

And when an open challenge convinces us, we **promote** it: it becomes an official challenge, with a CP pool, open to the ecosystem — and its author, who carried it from idea to promotion, is rewarded for having opened the road.

The Sandbox is how the leaderboard stops being a task board and becomes an ecosystem: ideas come from anywhere, the community votes with stars, and the best ones graduate into official challenges.

---

## 2. Concept and principles

- A **sandbox** is a contributor-proposed unit of work: title, description, and artifacts depending on its type. Health domain only (editorial rule, not enforced by code in V1).
- A sandbox has a **type**, chosen at creation among the promotable challenge types — `code` or `ml` (`validation` excluded). The type drives everything downstream: the expected inputs (`code` → GitHub repo only; `ml` → GitHub repo + model + datasets), the formative evaluation (which grid is used), and the promotion (the resulting challenge inherits the type — the admin no longer picks it).
- It is **not a challenge** and must not reuse the `challenges` table. It has no pool, no members, no tasks, no draft→active→completed lifecycle. It is a separate, cleanly-cut entity.
- **Only the author works on it.** Other contributors cannot join or contribute to a sandbox. They interact through stars only.
- The author can trigger a **formative evaluation** of their repo — same pipeline as a code challenge project evaluation, same grid, score /10 — but it awards **zero CP**. It exists to help the author improve, and incidentally gives admins an at-a-glance quality read when considering promotion.
- **Stars → CP via admin-defined tiers.** The admin defines an ordered list of milestones (e.g. 5 stars → 50 CP, 15 → 100, 50 → 300), as many as they want. CP is paid once per tier crossed, out of any pool. No linear per-star payout — tiers neutralize star farming.
- **Promotion** is an admin action from the Sandbox section: the sandbox becomes an official challenge (new `challenges` row), the author receives a promotion bonus and is auto-joined to the new challenge with their repo as `own_repo` — their work continues without friction. The sandbox is marked `promoted` and linked to the challenge.
- **Dev kit (concept only, not built in V1):** a dev kit is a base repo for a unit of work (e.g. the MyTwin app repo). Eventually, admins will manage a list of dev kits in their profile, and sandbox creation will offer "start from a dev kit". Nothing is implemented now — but the creation form should be shaped so a dev-kit selector can slot in later without restructuring.

---

## 3. Data model

### New table: `sandboxes`

| Column | Type | Notes |
|--------|------|-------|
| `uuid` | uuid PK | |
| `user_id` | FK → `users.uuid` | The author. Sole editor. |
| `type` | enum | `code` / `ml`. Chosen at creation, immutable. Drives input fields, evaluation grid, and promoted challenge type. |
| `title` | text | |
| `description` | text | Markdown allowed, rendered like challenge descriptions. |
| `repo_url` | text | Required for both types. The author's GitHub repo (may start nearly empty). |
| `model_url` | text, nullable | `ml` only — model artifact URL (e.g. Kaggle). |
| `dataset_urls` | JSON string array, nullable | `ml` only — dataset URL(s). |
| `status` | enum | `open` / `promoted` / `archived`. Created directly as `open` — no draft state. |
| `promoted_challenge_id` | FK → `challenges.uuid`, nullable | Set at promotion. |
| `evaluation` | JSON, nullable | Latest formative evaluation result (same shape as code challenge evaluations, normalized /10). |
| `evaluation_status` | enum, nullable | `pending` / `running` / `done` / `failed`. Mirrors the existing pattern; UI polls it. |
| `created_at` / `updated_at` | timestamps | |

Evaluation lives **on the row**, not in `contributions` — a sandbox is decorrelated from the challenge/contribution system, and its evaluation never touches the ledger.

### New table: `sandbox_stars`

| Column | Type | Notes |
|--------|------|-------|
| `uuid` | uuid PK | |
| `sandbox_id` | FK → `sandboxes.uuid` | |
| `user_id` | FK → `users.uuid` | |
| `created_at` | timestamp | |

Unique on (`sandbox_id`, `user_id`). Starring is a toggle (star / unstar), GitHub-style. Any signed-in user can star — contributors, patients, medical pros. Authors cannot star their own sandbox.

### Star tiers config (in `app_settings`)

A JSON setting, e.g. `sandbox_star_tiers`:

```json
{
  "tiers": [
    { "stars": 5,  "cp": 50 },
    { "stars": 15, "cp": 100 },
    { "stars": 50, "cp": 300 }
  ],
  "promotion_bonus_cp": 200
}
```

- Ordered, strictly increasing `stars`. The admin UI lets the admin add as many tiers as they want (a "+" row pattern).
- `promotion_bonus_cp` lives alongside — one config surface for the whole sandbox economy.

### Ledger (`reward_entries`)

Two new `rule_key` values, both **out of pool** (like `slack_signal`):

- `sandbox_star_tier` — one entry per (sandbox, tier) crossed. **Idempotent**: uniqueness on sandbox + tier threshold means un-star/re-star cycles can never double-pay, and a tier once paid is never clawed back if stars later drop below it.
- `sandbox_promotion` — one entry per sandbox, at promotion, for `promotion_bonus_cp`.

---

## 4. Flows

### Creating a sandbox

1. Signed-in contributor opens the Sandbox section → "New sandbox".
2. **Type selection first**: `code` or `ml`. The form then shows the inputs for that type:
   - `code`: title, description, GitHub repo URL (required).
   - `ml`: title, description, GitHub repo URL (required), model URL, dataset URL(s).
3. Created directly as `open` — immediately visible in the Sandbox listing. No admin approval to exist. Type is immutable after creation.

*Future-proofing:* the form's "starting point" area is where a dev-kit selector will later appear ("start from a dev kit" → shows the base repo to fork). V1 ships without it; just don't design the form in a way that makes this an overhaul.

### Starring

1. Any signed-in user (except the author) toggles a star on a sandbox card or detail page.
2. On star, the service recomputes the star count and checks tiers: for each tier whose threshold is now met **and** has no existing ledger entry for this sandbox, write a `sandbox_star_tier` entry crediting the author.
3. On unstar, nothing is reversed. Counts go down; paid tiers stay paid.

### Formative evaluation

1. The author triggers evaluation from their sandbox page.
2. Same fire-and-forget pattern as the existing evaluations, with the grid selected by the sandbox's type:
   - `code` → repo snapshot scored against the `code` grid, like a code challenge project evaluation.
   - `ml` → scored against the `model` grid (ML weight profile), taking the repo + model artifact as input, like an ML model contribution evaluation.
   Both normalize to a score /10.
3. Result stored in `sandboxes.evaluation`, status flow `pending → running → done|failed`, UI polls.
4. **No ledger writes. No CP.** The score is visible to the author and to admins/managers (useful signal at promotion time).
5. One `running` evaluation per sandbox at a time; the author can re-run after improving.

### Promotion

1. Admin (or manager), from the Sandbox section, opens a sandbox and clicks "Promote to challenge".
2. The challenge **type is inherited from the sandbox** (`code` or `ml`) — the admin doesn't choose it. The admin sets up the rest as usual: pool (CP reward), reward rules, dates, project attachment. The sandbox's title/description/repo (and model/datasets for `ml`) pre-fill the form.
3. On confirm, in one operation:
   - New `challenges` row is created (normal challenge, nothing special about it afterwards).
   - `sandboxes.status` → `promoted`, `promoted_challenge_id` set.
   - The author is auto-joined to the new challenge with `own_repo` = the sandbox's repo — their work continues seamlessly; they are a normal member from then on.
   - Ledger entry `sandbox_promotion` credits the author with `promotion_bonus_cp`.
4. Other contributors join the promoted challenge through the normal challenge flow. The Sandbox listing shows the sandbox as promoted, linking to the official challenge.

---

## 5. UI

### Navigation

The **About** tab in the left navigation is **replaced by Sandbox**. (About's content, if kept anywhere, is out of scope here.)

### Sandbox section (`/sandbox`)

- **Listing**: cards for `open` sandboxes (type badge `code`/`ml`, title, author, star count, star toggle, evaluation badge if a score exists). `promoted` sandboxes shown distinctly with a link to their challenge. Sorted by stars by default.
- **Detail page**: full description (Markdown), repo link, model link, star toggle, star count with tier progress hints for the author.
- **Author view** adds: edit (title/description/repo/model), "Run evaluation" with the score panel, archive.
- **Admin/manager view** adds: "Promote to challenge" (opens the pre-filled challenge creation flow), archive any sandbox.

### Admin config

Star tiers + promotion bonus editor, following the existing admin-settings surface patterns: a list of tier rows (stars, CP) with add/remove, plus the promotion bonus field. Placement per current admin conventions (admin tab in `/contributors/me`, like other instance config).

### Visibility

V1: Sandbox is for **signed-in users** (all roles). Anonymous visitors don't see it — no change to the public allowlist. (Newsletter/external likes are a later phase and a separate mechanism.)

---

## 6. API sketch

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/sandboxes` | List sandboxes (with star counts, caller's star state). | Signed-in |
| `POST` | `/api/sandboxes` | Create a sandbox. | Contributor |
| `GET` | `/api/sandboxes/:id` | Detail. | Signed-in |
| `PATCH` | `/api/sandboxes/:id` | Edit title/description/repo/model; archive. | Author (archive also admin) |
| `PUT` | `/api/sandboxes/:id/star` | Star (idempotent). Triggers tier check. | Signed-in, not the author |
| `DELETE` | `/api/sandboxes/:id/star` | Unstar. Never reverses paid tiers. | Signed-in |
| `POST` | `/api/sandboxes/:id/evaluation` | Trigger formative evaluation. | Author |
| `POST` | `/api/sandboxes/:id/promote` | Create the official challenge, link, auto-join author, pay bonus. | Admin or manager |

Settings read/write goes through the existing `app_settings` routes/patterns.

---

## 7. Out of scope (V1) — explicitly deferred

- **Dev kits**: concept acknowledged (base repo for a unit of work, e.g. the MyTwin app repo; future admin-managed list), zero implementation now.
- **Newsletter / external likes**: like-in-email from non-authenticated readers. Separate mechanism, analytic signal only when it comes — it will not touch the CP economy.
- **Tags / categories** on sandboxes (admin-defined vocabulary).
- **Multi-contributor sandboxes**: deliberately blocked. Only the author works on a sandbox; collaboration happens after promotion, on the challenge.
- **Domain enforcement**: "health domain only" is an editorial/moderation rule in V1, not validated by code.

---

## 8. Implementation notes

- Follow existing patterns throughout: repository layer in `packages/database-service/repositories/`, service in `packages/services/`, routes under `apps/leaderboard-client/src/app/api/sandboxes/`, evaluation reuse from the code-challenge pipeline (`packages/evaluator/` + the project-evaluation service path).
- New columns/tables must be added to both `drizzle.ts` **and** `scripts/db-apply-schema.ts` (production schema application — see `database.md#migrations`).
- Tier payout must be race-safe: concurrent stars crossing the same threshold must resolve to exactly one ledger entry per tier (unique constraint, insert-or-ignore — same defensive pattern as validation claim uniqueness).
- The promote operation should be transactional across challenge creation, sandbox update, auto-join, and the bonus ledger entry.
- No change to `lib/public/challengeVisibility.ts` or any anonymous-visitor allowlist.
