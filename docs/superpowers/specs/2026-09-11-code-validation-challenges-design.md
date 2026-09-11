# Code Validation Challenges — Design

## Purpose

Today a `validation` challenge can only be backed by an `ml` challenge: it exposes
`api_packaging` submissions, the platform calls each one's live endpoint with a
reference case, and a `medical_pro` compares the response to a hidden ground truth
and votes `works` / `broken`. `docs/validation-challenges.md` lists the gap plainly —
*"Only `ml` challenges' `api_packaging` submissions — no other submission type, and
no path to `code` challenges yet."*

A `code` challenge's deliverable is a `project` contribution scored **only by the AI
grid** (`code_fixed` + `code_quality`). Nobody ever uses the application that was
built. This design adds the human half: the team deploys a contributor's application,
an admin exposes it on a validation challenge, and any contributor walks a fixed
**scenario** through it — step by step, marking each step as passed, failed or
blocked, leaving comments, and closing with a mandatory overall feedback. Finishing
a walkthrough pays a fixed amount of CP from the validation challenge's own pool.

This is not an automated grader. Like the ML flow, it never touches
`evaluation_status`, `evaluation` or `globalScore` on the source contribution — it
answers a different question (*is this application actually usable?*) with its own
budget.

## Why extend `validation` rather than add a new challenge type

Half of the ML mechanism is about the application under test: expose a contribution,
attach a URL, track who tested what, pay from a pool through the
`rule_key: 'validation'` ledger. That half is identical here and is already written
and tested (`validation_targets`, `ValidationTargetsEditor`, `ValidationRewardsPanel`,
the aggregate `type: 'validation'` contribution pattern).

The other half — *how you judge* — is genuinely different, and gets its own tables
rather than being bent into the reference-case ones. Reusing
`validation_reference_cases` for scenario steps would mean a "reference case" with no
reference and permanently null `expected_output_*` columns; nobody would be able to
read the schema six months later.

**The mode is derived, never stored.** `source_challenge_id` pointing at an `ml`
challenge means the reference-case flow; pointing at a `code` challenge means the
scenario flow. A `validation_mode` column would be a second source of truth that can
drift from the first.

## Core concepts

| Concept | Description |
|---|---|
| **Scenario** | An ordered list of **steps** ("Create an account", "Add an item to the cart"), authored by the admin/manager at challenge creation. Shared by every application exposed on the challenge — all contributors built against the same brief, so they face the same walkthrough. Frozen the moment the first walkthrough starts. |
| **Step** | One instruction. Carries a title and optional longer instructions. Never called a "task": `tasks` already means the personal kanban of a `code` challenge, and both will live in the same app. |
| **Target** | One exposed application: a `project` contribution from the source `code` challenge, plus the URL where the team deployed it. Same `validation_targets` row as ML, same admin gesture. |
| **Walkthrough** | One validator's pass over one application: a feedback per step, then an overall feedback. Resumable while in progress, immutable once completed. Completing it pays `cp_per_validation`. |
| **Medical comment** | A second, distinct comment a `medical_pro` may leave on a step, alongside the user-experience comment rather than instead of it. |

There is **no quorum, no majority and no verdict** in this iteration. Every completed
walkthrough pays. See [Out of scope](#out-of-scope-this-iteration).

## Data model changes

### `challenges` (existing table, no schema change)

- `source_challenge_id` may now reference a `code` challenge. The 1:1 rule and the
  service-layer checks are unchanged.
- `contribution_points_reward` — the validation challenge's CP pool, as today.
- `cp_per_validation` — reused verbatim: the CP paid for one completed walkthrough.
- `required_validations` — stays `NULL` in scenario mode, and the field is not
  offered in the creation form when the source challenge is `code`.

### `validation_targets` (existing table, no schema change)

One row per exposed application. `contribution_id` points at a `type: 'project'`
contribution instead of `api_packaging`. `outcome` stays `'pending'` and
`resolved_at` stays `NULL` — nothing resolves in scenario mode.

The deployed application's URL lives in `contributions.live_endpoint_url`, typed by
the admin when exposing the target. The column is a plain nullable
`varchar(500)` on `contributions` with no type gating in the schema; the
`api_packaging` restriction exists only in
`apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts`
(the eligible-list filter and the POST guard). Both become type-aware:
`api_packaging` when the source is `ml`, `project` when it is `code`.

### `validation_scenario_steps` (new table)

```
uuid                     pk
validation_challenge_id  fk -> challenges.uuid, cascade
position                 integer      -- display order
title                    varchar      -- "Create an account"
instructions             text         -- optional, the detail of the instruction
```

Admin-authored, shared across every target on the challenge.

### `validation_scenario_runs` (new table)

```
uuid                     pk
validation_challenge_id  fk -> challenges.uuid, cascade
contribution_id          fk -> contributions.uuid, cascade   -- the application walked
validator_user_id        fk -> users.uuid, cascade
global_feedback          text         -- required at completion
completed_at             timestamp    -- NULL while the walkthrough is a draft
created_at               timestamp default now()

unique (validation_challenge_id, contribution_id, validator_user_id)
```

The unique index does the same job `validation_attempts`' does today: one walkthrough
per (validator, application), so CP is paid once, enforced by the database rather than
by an application-level check — concurrent requests race safely.

`completed_at NULL` is a draft. A validator who closes the tab at step 4 of 7 comes
back to exactly what they had filled in. There is no reservation step, so there is no
abandoned-walkthrough state to clean up — the same property as the ML claim.

### `validation_step_feedbacks` (new table)

```
uuid             pk
run_id           fk -> validation_scenario_runs.uuid, cascade
step_id          fk -> validation_scenario_steps.uuid, cascade
result           varchar      -- 'passed' | 'failed' | 'blocked'
comment          text         -- optional — user experience
medical_comment  text         -- optional — medical_pro only
unique (run_id, step_id)
```

`medical_comment` is a column rather than a row-per-lens because there are exactly two
lenses. A third one (security, accessibility) would justify splitting into rows with a
discriminator; two does not.

### `reward_entries` (existing ledger, no schema change)

Unchanged pattern: `rule_key: 'validation'`, `challenge_id` = the validation challenge,
attributed to the validator's aggregate `type: 'validation'` contribution for that
challenge, `points = cp_per_validation` clamped to whatever remains in the pool. One
row per completed walkthrough.

Because the ledger shape is identical, `GET /api/challenges/:id/validation-rewards`
and `ValidationRewardsPanel` work with no change at all.

### Deployment note

`scripts/db-apply-schema.ts` must gain the three new tables. `docs/deployment.md` is
explicit that the `postdeploy` hook does not run `drizzle-kit push`, so a change to
`drizzle.ts` alone will not reach production.

## Request flow

### Admin / manager, at creation

```
1. Create the validation challenge
     source_challenge_id -> a type 'code' challenge
     contribution_points_reward (pool), cp_per_validation
     -> required_validations is not offered when the source is 'code'

2. POST   /api/challenges/:id/validation-scenario-steps   { title, instructions }
   PATCH  /api/challenges/:id/validation-scenario-steps/:stepId  { title?, instructions?, position? }
   DELETE /api/challenges/:id/validation-scenario-steps/:stepId
     as many steps as needed, reorderable
     -> all three return 409 once any walkthrough exists on the challenge

3. POST /api/challenges/:id/validation-targets   { contributionId, endpointUrl }
     existing route; only eligibility changes:
     'api_packaging' when the source is 'ml', 'project' when it is 'code'
```

Exposing a target assumes the team has already deployed that contributor's
application and made it embeddable — see [The application is displayed in an
iframe](#the-application-is-displayed-in-an-iframe).

### Validator

```
GET  /api/challenges/:id/validation-scenario-steps
       the scenario, in order — readable by any signed-in contributor
       (it is the protocol, not a secret: nothing is hidden from the validator
       in scenario mode, unlike a reference case's expected output)

GET  /api/challenges/:id/validation-targets
       exposed applications + my state on each
       (never started / in progress / completed)

POST /api/challenges/:id/validation-scenario-runs   { contributionId }
       idempotent: creates the draft, or returns the one I left unfinished
       together with the step feedbacks already recorded
       -> rejected if the application is mine (see the group rule below)

PUT  /api/challenges/:id/validation-scenario-runs/:runId/steps/:stepId
       { result: passed|failed|blocked, comment?, medical_comment? }
       upsert, editable while the walkthrough is a draft
       -> 403 on medical_comment if the caller is not medical_pro

POST /api/challenges/:id/validation-scenario-runs/:runId/complete
       { global_feedback }
       -> rejected if any step has no feedback
       -> rejected if global_feedback is empty
       -> rejected if already completed (a completed walkthrough is immutable)
       -> otherwise: completed_at = now, and one reward_entries row
          (rule_key 'validation', cp_per_validation, clamped to the remaining pool)
```

### Guards

- **Not my own application.** Checked against `contributions.user_id` **and** against
  `contribution_members`: `code` challenges support groups of 2–3 contributors sharing
  one contribution, where `user_id` is only the *holder*. A naive `user_id` check would
  let a co-member validate their own group's application. `ml` challenges have no
  groups, so this guard has no equivalent in the existing flow — it is new code, not a
  port.
- Checked both when the walkthrough is created and again at completion — the same
  defense-in-depth posture as `castVerdict`, which re-verifies what the reveal route
  already enforced.
- **One walkthrough per (validator, application)**, enforced by the unique index.
- **The medical comment is gated on the role**, not on challenge membership — the same
  boundary `medical_pro` already draws today.
- **The scenario freezes at the first walkthrough.**

### No proxy, and therefore no SSRF guard

The platform never calls the application: the validator's own browser loads it. There
is no proxy, no timeout, no size cap, and `assertPublicHttpUrl` has nothing to protect
here — it existed to defend the *server* that was issuing the request. The URL is still
validated as `http`/`https` on save, so a `javascript:` URL can never be stored and
later rendered as a link.

## UI

### Admin / manager — configuration

- `ValidationTargetsEditor` (existing) — the eligible list becomes the source
  challenge's `project` contributions, URL field unchanged. The **required
  validations** field disappears from the creation form when the source is `code`.
- `ScenarioStepsEditor` (new) — the ordered list of steps: title, optional
  instructions, reorderable, deletable. Turns read-only with an explicit message once
  a walkthrough exists, mirroring the already-disabled delete button on a target that
  carries verdicts.

### Admin / manager — oversight

A walkthroughs panel, sibling to `ValidationRunsPanel`, fed by a new
`GET /api/challenges/:id/validation-scenario-runs` (admin or manager of this challenge
only, unlike the target list, which every contributor needs): per application, who
tested it, the step-by-step results, the comments, the medical opinions, and the
overall feedback.

With no quorum, **this panel is the only quality control in v1**, so it has to be
readable — a structured view, not a JSON dump.

`ValidationRewardsPanel` is unchanged.

### Validator — the challenge page

The exposed applications, each with my state: *never started* / *in progress* /
*completed, X CP*. The remaining pool is shown on the page — `MLChallengeFlow` already
has that contributor-facing banner and it is reusable — so an exhausted pool is visible
before the work rather than after it.

### Validator — the walkthrough screen

- **Left**: the application in a full-height iframe. An "open in a tab" button beside
  it — not as an architectural fallback, simply because a real application is cramped
  in half a window.
- **Right**: the roadmap. Per step: the title, expandable instructions, three buttons
  `Passed` / `Failed` / `Blocked`, and an optional comment box. A `medical_pro` also
  gets a visually distinct **medical opinion** field underneath — not a tab, not a
  mode: both lenses coexist on the same step.
- **Saved as you go**: each entry issues its step `PUT`.
- **Bottom**: the overall feedback (required) and the **Finish** button. Disabled while
  a step has no result or the overall feedback is empty — and the button states *why*
  ("2 steps still have no result") instead of sitting greyed out.
- **After completion**: everything becomes read-only, with a "Walkthrough completed —
  X CP" banner.

### The application is displayed in an iframe

Whether an iframe works is decided by `X-Frame-Options` / `CSP: frame-ancestors`,
which come from the **contributor's application code**, not from the host — Django
sends `SAMEORIGIN` by default, Express + helmet too, Next.js does not.

Since the team deploys these applications itself, making an application embeddable is a
**manual step of putting it online**, performed before the target is exposed. The
platform neither detects nor works around a non-embeddable application; a proxy that
strips the header is explicitly deferred (see Out of scope).

## Error handling / edge cases

- **The application does not start, or dies mid-walkthrough.** Nothing happens
  platform-side — there is no proxy, so no failure is detected. The validator marks the
  step `Blocked` and explains. This is the correct behaviour: an application that does
  not run is a validation result, not a system fault. It is the opposite of the ML flow,
  where a failed call records nothing and a permanently broken endpoint can never
  resolve — a documented limitation that simply does not exist here.
- **The application refuses the iframe.** Not detected. Fixed by hand at deploy time;
  the "open in a tab" button keeps the validator unblocked meanwhile.
- **Pool exhausted.** Clamped to whatever remains, as everywhere else: a walkthrough
  completed against an empty pool pays 0. The pool banner is what prevents this from
  being a surprise.
- **An application exposed later.** Each (validator, application) pair is independent,
  so this is fine. The scenario, however, is frozen at challenge level: a late
  application is walked with the same steps as the others — deliberately, otherwise
  walkthroughs stop being comparable.
- **Abandoned walkthrough.** A draft may sit forever. Nothing to clean up, nobody
  blocked.
- **Deletions.** Walkthroughs cascade from the challenge and from the contribution,
  step feedbacks from the walkthrough — they do **not** hang off `validation_targets`,
  so un-exposing a target leaves its walkthroughs intact rather than silently
  destroying feedback that has already been paid for. Deleting a step is impossible
  once any walkthrough exists, which is what keeps `validation_step_feedbacks.step_id`
  from ever dangling. `reward_entries` survive, as any ledger does.
- **A non-`medical_pro` validator** simply has no medical field; posting one anyway
  returns 403.

## Out of scope (this iteration)

- **No quorum, no majority, no verdict** — every completed walkthrough pays. The
  anti-gaming property the ML flow gets from majority payment is replaced by nothing
  but the oversight panel and the fact that feedback is signed and readable. If it
  proves insufficient, the mechanism exists on the ML side and this data model can host
  it: `result` per step is already a vote that simply is not counted.
- No effect on `evaluation_status` / `evaluation` / `globalScore` of the `project`
  contribution.
- No reward for the application's author when their application validates well — CP
  stays entirely on the validator side, unchanged from ML.
- No automated deployment of the applications under test; deployment stays a manual
  team operation outside the platform.
- No iframe proxy stripping `X-Frame-Options`.
- No per-application scenario.
- No editing a scenario after the first walkthrough; no editing a completed
  walkthrough.
- No retention or purge policy for feedback content, consistent with what the existing
  validation flow already documents.
