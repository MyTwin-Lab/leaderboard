# Validation Challenges — Quorum Verdicts — Design

## Purpose

Today's `type: 'validation'` challenges (see [`validation-challenges.md`](../../validation-challenges.md)) prove only that a contributor's deployed API *responded* — a validator drops a file, sees the raw output, and earns CP the first time the proxied call succeeds. Nothing about the response's quality is captured; "works" and "returns garbage" earn the same reward.

This design adds a **quorum-based human verdict** on top of the existing proxy mechanism: each validator who successfully calls a target's endpoint casts a verdict — **Fonctionne** or **Défectueux** — instead of earning CP for the mere act of calling. Once a target collects a fixed number of verdicts (set once per validation challenge), the majority verdict is computed, and CP is paid **only to validators on the majority side**. This turns "did it respond" into "do independent humans agree it actually works," without requiring an admin-authored ground truth (rejected — the platform's ML challenges span task types with no single definition of a "correct" output, and curating ground truth per challenge doesn't scale).

## Core concepts

| Concept | Description |
|---|---|
| **Required validations (N)** | New per-validation-challenge setting, `challenges.required_validations`. Set once at creation, locked afterward (same treatment as `cp_per_validation`/`source_challenge_id`). Must be odd, so a majority always exists. Applies uniformly to every target exposed on that challenge. |
| **Verdict** | What a validator casts after a successful proxied call: `works` or `broken`, plus a description (required for `broken`, optional for `works`). One verdict per `(validator, target)`, immutable once cast. |
| **Resolution** | The moment a target's Nth verdict arrives: the majority side is computed, the target is permanently marked `works` or `broken`, and CP is paid to every validator on the majority side. Happens once per target, ever. |
| **Blind quorum** | Before a target resolves, validators see only a participation count ("3/5 validations reçues") — never the works/broken split — so each verdict is an independent judgment, not a reaction to the running tally. |

This is still not an automated grader — it doesn't touch `evaluation_status`/`evaluation`/`globalScore` on the source `api_packaging` contribution. It replaces the *reward timing and criterion* of the existing validation mechanism; the proxy call itself (SSRF guard, timeout, size cap) is unchanged.

## Data model changes

### `challenges` (existing table)

- New nullable column `required_validations integer` — validation challenges only. Must be odd (enforced at the service layer on creation). Locked after creation, like `cp_per_validation`.

### `validation_targets` (existing table)

- New nullable column `outcome varchar` — `'pending' | 'works' | 'broken'`, defaults to `'pending'`.
- New nullable column `resolved_at timestamp` — set exactly once, when the Nth verdict lands.

Both are written only by the resolution step (Task in the implementation plan); everywhere else they're read-only.

### `validation_attempts` (existing table)

Repurposed from a pure dedupe record into the verdict record itself:

- New column `verdict varchar` — `'works' | 'broken'`. Not nullable (a row is only ever inserted once a verdict is cast — an attempt row is no longer created for the sole purpose of "this validator successfully called the endpoint").
- New nullable column `description text` — required at the API/service layer when `verdict = 'broken'`, optional when `verdict = 'works'`.

The existing unique index on `(validation_challenge_id, contribution_id, validator_user_id)` is unchanged and still does the same job: one verdict per validator per target, race-safe.

### `reward_entries` (existing ledger, no schema change)

- Still `rule_key: 'validation'`, still attributed to the validator's aggregate `type: 'validation'` contribution for that validation challenge (unchanged pattern).
- Behavior change: entries for a target's validators are created **as a batch, at resolution time** — not one at a time as each validator calls the endpoint. Only validators whose verdict matches the resolved outcome get an entry; the minority side gets none.
- Clamping is unchanged in spirit (never exceed what's left in the pool) but now applies across the whole batch: entries are created in the chronological order the verdicts were cast, each clamped to whatever remains after the previous one — so if the pool runs out mid-batch, the earliest majority voters get paid first.

## Request flow

```
Validator drops a file on an exposed target
  → proxy call exactly as today (SSRF guard, 15s timeout, 10MB cap)
  → call fails (timeout / non-2xx / SSRF-blocked / unreachable):
      → unchanged from today: no attempt row, no vote counted, validator can retry
  → call succeeds (2xx):
      → output rendered generically (image/JSON/text), as today
      → validator casts a verdict: works | broken (+ description, required if broken)
      → POST verdict
          → reject if validator == the target contribution's owner (self-vote)
          → reject if validator already has a verdict on this target (immutable)
          → insert the verdict row
          → if count(verdicts for this target) == required_validations
             AND target.outcome is still 'pending':
               - compute majority side (N is odd, so no ties)
               - set validation_targets.outcome + resolved_at (once, permanently)
               - for each verdict on the majority side, in the order cast:
                   create a reward_entries row for cp_per_validation,
                   clamped to whatever remains in the challenge's pool
  → client shows: "N/required_validations validations reçues" while pending
                  (no works/broken breakdown);
                  once resolved: a permanent "✅ Fonctionne" / "❌ Défectueux" badge
                  with N validations, and the collected descriptions
```

The Nth-verdict resolution must happen exactly once even under concurrent requests (two validators' verdicts landing near-simultaneously on the same target) — handled via a transaction/row-level lock on the target during insert-and-maybe-resolve, deferred to the implementation plan.

## UI

- **Admin (validation challenge creation):** existing fields (source ML challenge, CP pool, `cp_per_validation`) plus a new **required validations** field — an odd number, locked after creation. Target selection (which `api_packaging` submissions to expose) is unchanged.
- **Validation challenge page:** each target shows its status — `"3/5 validations reçues"` while pending, or a resolved badge (`✅ Fonctionne` / `❌ Défectueux`) with the descriptions left by validators once resolved.
- **Dropzone flow:** drop file → see rendered output (unchanged) → two buttons, **Fonctionne** / **Défectueux**, with a description textarea that becomes required the moment Défectueux is selected. Already-voted validators see their own past verdict; the dropzone stays usable afterward for repeat testing but is clearly marked as no longer earning CP once the target has resolved.

### Manager view — live monitoring

`ValidationTargetsEditor.tsx` today is pure CRUD (add/remove exposed targets) with no status shown. It gains, per target:

- **Pending:** the full split — `"2/5 votes (1 Fonctionne, 1 Défectueux)"` — visible to the manager only. Regular validators keep seeing just the blind participation count (`"2/5 validations reçues"`), per the blind-quorum rule above; the manager is the one exception, for oversight (spotting a stalled target or a suspicious pattern before it resolves).
- **Resolved:** the same `✅ Fonctionne (3/5)` / `❌ Défectueux (3/5)` badge everyone sees, plus the resolution date.
- **Remove button:** disabled, with an explanatory tooltip, the moment any verdict exists for that target — prevents silently discarding vote history (and, for a resolved target, already-paid CP) by deleting the row.

**Reusing the existing endpoint, not adding a new one:** `GET /api/challenges/:id/validation-targets` already serves both `ValidationTargetsEditor` (admin/manager) and `ValidationChallengeFlow` (contributor voting) — the same route, gated today by an `authorize()` helper (admin or `isManagerOfChallenge`) only for the `?eligible=true` branch. The default branch must stay role-aware without ever failing the request for a non-manager (contributors need it to load their voting page):

- Everyone gets `verdictCount`, `outcome`, `resolvedAt` (the last two only once resolved — the resolved outcome is public by design, per the UI section above).
- Only when the caller is admin/manager of this challenge (same `isManagerOfChallenge` check, applied without erroring for everyone else) does the response also include `worksCount` / `brokenCount` while the target is still `pending`.

`DELETE /api/challenges/:id/validation-targets/:targetId` gains a check: if any `validation_attempts` row exists for that target, reject with 409 instead of deleting.

**Pool CP panel (new):** a small admin-side summary next to the targets list — pool / distributed / remaining, and a per-validator breakdown of who earned what. Mirrors the shape of the existing `GET /api/challenges/:id/ml-rewards` (pool state for `ml` challenges), applied here as a new `GET /api/challenges/:id/validation-rewards` scoped to `type: 'validation'` and `rule_key: 'validation'` reward entries. Note: `ml-rewards`' pool banner today is contributor-facing only (inside `MLChallengeFlow.tsx`) — there is no existing admin-side pool panel to copy wholesale; this is the first one, built to the same data shape but as a new component.

## Error handling / edge cases

- **Self-vote:** rejected at the service layer — the target contribution's `user_id` cannot cast a verdict on it.
- **Double vote:** rejected — one verdict per `(validator, target)`, enforced by the existing unique index.
- **Technical failure (timeout/5xx/SSRF-blocked):** unchanged from today — no verdict is recorded, no quorum progress, validator retries. A persistently broken endpoint that never returns 2xx will never resolve via quorum; this is an accepted v1 gap (see Out of scope).
- **Target never reaches quorum:** stays `pending` indefinitely if too few validators participate. No CP paid, no error state — just an unresolved target, visible as partial progress.
- **Pool exhausted mid-batch:** later majority-side validators in the same resolution batch may be clamped to zero if the pool runs out — same "reduced to whatever remains" philosophy as ML rewards, just applied across a batch instead of a single award.
- **Voting after resolution:** allowed (repeat testing for sanity-checking), but the verdict is not recorded against the (already-permanent) outcome and earns no CP.

## Out of scope (this iteration)

- A target that never gets a single successful (2xx) response can never resolve, even if it's obviously broken — there's no "N technical failures = broken" path. Judged acceptable: a persistently unreachable endpoint is already useless to the ML challenge regardless of whether this system labels it `broken`.
- Any reward or recognition for the `api_packaging` contribution's author when their target resolves `works` — this iteration's CP stays entirely on the validator side, as today.
- Changing `required_validations` after a validation challenge is created, or after some targets have already partially resolved.
- Anything beyond `ml` challenges' `api_packaging` submissions (unchanged scope from v1).
