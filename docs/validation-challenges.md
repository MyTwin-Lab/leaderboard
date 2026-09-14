# Validation Challenges

`type: 'validation'` challenges let people check whether what a contributor delivered
actually works — with their own CP pool, and without ever touching the source
contribution's grade. A validation challenge is linked 1:1 to a **source challenge**,
and **the source challenge's type decides how the judging works**:

| Source challenge | Mode | What is exposed | How it is judged | Who may judge |
|---|---|---|---|---|
| `ml` | **Reference case** | an `api_packaging` submission + its deployed endpoint | the platform calls the endpoint with a ground-truth input; the reviewer records what they saw, reveals the expected output, then votes `works` / `broken`. Majority pays once quorum is reached. | `medical_pro` only |
| `code` | **Scenario walkthrough** | a `project` deliverable the team deployed + its URL | a validator walks a fixed, admin-authored scenario through the application in an iframe, marking each step `passed` / `failed` / `blocked` with a comment, then closes with a mandatory overall feedback. Every completed walkthrough pays. | any signed-in contributor (the *medical opinion* field is `medical_pro`-only) |

**The mode is derived, never stored.** There is no `validation_mode` column: every read
resolves `source_challenge_id` and looks at that challenge's `type`
(`packages/services/challenge/validation-mode.ts`). A stored column would be a second
source of truth that can drift from the first.

---

## Why a separate system

An `ml` challenge's "API packaging" step is scored purely by AI-grading the packaging *code* — nobody actually calls the deployed model to see if it works. A validation challenge adds that missing piece.

It is deliberately **not** an automated grader. It never touches `evaluation_status`, `evaluation`, or `globalScore` on the source contribution — it is a fully separate mechanism with its own CP pool, answering a different question (*does it work?*, not *how good is the code?*).

The reference-case machinery exists to answer a second question: *can we trust the verdict?* A reviewer who invents their own test input and sees the answer first has no way to be wrong. Ground truth authored by someone else, plus a mandatory written observation before the reveal, is what makes a verdict mean something.

The same gap exists on the `code` side: a code challenge's tasks are AI-graded from the diff, but nobody actually clicks through the running application the way an end user would. Scenario mode adds that missing piece for `code` challenges, the same way reference cases add it for `ml` — same separation from `evaluation_status`/`evaluation`/`globalScore`, same own CP pool, different judging mechanism because there is no single ground-truth output to compare against, only a scenario to walk.

---

## The `medical_pro` role

Validation is gated on a dedicated role — `users.role = 'medical_pro'` — not on challenge membership. Only a `medical_pro` can author a reference case, claim one, record an observation, reveal an expected output, or cast a verdict. Admins and project managers get oversight (they can read every case and every run) but **cannot** author cases or vote: authorship is a qualification boundary, not a permission level.

In scenario mode the walkthrough itself is open to any signed-in contributor — there is no ground truth to be qualified to judge against, only steps to follow. "Contributor" means what it says, though: `openWalkthrough` allows `contributor`, `medical_pro` and `admin`, and refuses `viewer` (`ValidatorRoleError`, 403). `viewer` is a real assignable, read-only-everywhere-else role, and a walkthrough pays CP on completion — a viewer wrongly refused costs an admin a role change, CP paid to a read-only account does not come back. The one place the role still matters beyond that is the optional medical opinion on each step: writing it is gated on `role = 'medical_pro'`, exactly the same qualification boundary as above, just narrowed to one field instead of the whole flow.

The role is assigned by an admin in `/admin/users`. See [`auth.md`](./auth.md#roles).

---

## Reference-case mode

A validation challenge is a `challenges` row with `type: 'validation'`, linked 1:1 to an existing `ml` "work challenge" via `source_challenge_id`. It carries its own `contribution_points_reward` (CP pool), `cp_per_validation` (fixed CP per validator on the winning side), and `required_validations` (an odd number of verdicts a target needs to resolve) — all three set once at creation and locked afterward.

### 1. Exposing a target

```
Contributor (ML workspace, API packaging step)
  → submits a GitHub repo URL, creating the api_packaging contribution

Admin / manager (validation challenge config)
  → POST /api/challenges/:id/validation-targets
    picks which api_packaging contribution to expose and types its deployed
    endpoint URL at that same moment
      ↓ saved to contributions.live_endpoint_url, creates a validation_targets row
```

The contributor never declares the endpoint — an admin or manager does, when exposing the submission.

### 2. Authoring the ground truth

```
medical_pro
  → POST /api/challenges/:id/validation-reference-cases   (multipart: input, expected_output)
    → exactly `required_validations` cases per validation challenge, enforced
      by ReferenceCaseService (a DB constraint can't count sibling rows)
```

Cases are shared across every target on the challenge — the right answer for a case doesn't depend on which contributor is being tested. The expected output bytes are only ever readable through the reveal route below: there is deliberately **no** endpoint that serves them directly (the input has one, `GET .../validation-reference-cases/:caseId/input`, for the author and for admin/manager oversight).

### 3. Claim, observe, reveal, vote

```
medical_pro (validation challenge page)
  → GET  /api/challenges/:id/validation-targets/:targetId/claimable-cases
      cases still claimable on this target, plus their own unfinished claims
      so an interrupted sequence resumes instead of restarting

  → POST /api/challenges/:id/validation-targets/:targetId/claim   { reference_case_id }
      claim and test are ONE gesture: the server SSRF-guards the endpoint,
      proxies the case's input file to it, and stores the raw response on the
      claim atomically. There is no reservation step, so there is no
      abandoned-claim state to clean up.
      → returns the raw response bytes + X-Validation-Status + X-Claim-Id

  → POST /api/challenges/:id/validation-case-claims/:claimId/observation  { observation }
      free-text note on what they saw — recorded BEFORE any answer is visible

  → POST /api/challenges/:id/validation-case-claims/:claimId/reveal
      returns the expected output — 409 (ObservationRequiredError) if no
      observation has been recorded yet. This is the anti-confirmation-bias
      enforcement point: a client cannot obtain these bytes out of order,
      whatever it does.

  → POST /api/challenges/:id/validation-verdicts
      { contribution_id, verdict, description, reference_case_claim_id }
      castVerdict independently re-checks that the claim is revealed —
      defense in depth, not reliance on the reveal route alone.
```

Guards along the way: you cannot claim a case **you** authored, you cannot vote on your **own** submission, one claim per (case, target) — enforced by a unique index, so concurrent claims race safely — and one verdict per validator per target.

### 4. Resolution and payment

Once a target has collected `required_validations` verdicts, it resolves permanently: `works` or `broken` by simple majority. Every validator on the majority side is paid `cp_per_validation`, clamped to whatever is left in the pool, earliest voters first. The minority earns nothing, even though they did the same work.

- Before resolution, everyone sees only a blind participation count ("3/5 validations reçues") — never the works/broken split. The challenge's admin/manager is the exception, seeing the live split for oversight.
- One `type: 'validation'` contribution per validator per challenge aggregates the ledger (`rule_key: 'validation'`), mirroring the `type: 'discussion'` pattern used for Slack signals — a chip, not a contribution-list entry.
- A failed proxied call (timeout, non-2xx, SSRF-blocked, redirect) records no claim and no quorum progress — the reviewer can retry.
- A target that never collects enough votes just stays unresolved. No CP paid, no error.

### Why the browser never calls the endpoint

Third-party deployments (HuggingFace Spaces, Render, …) generally won't have CORS configured for this app's origin, and a client-side "I got a valid response" claim would be unverifiable and would make the CP award trivially spoofable. The server observes the response, so the server decides whether CP is earned.

---

## Admin & manager oversight

- `GET /api/challenges/:id/validation-runs` — every verdict cast on the challenge, metadata only.
- `GET /api/challenges/:id/validation-runs/:attemptId/file` and `/response` — the exact bytes involved in one run. For a claim-backed verdict the evidence actually lives on `validation_case_claims` (the live response) and `validation_reference_cases` (the input); these routes fall back to the claim/case automatically.
- `GET /api/challenges/:id/validation-reference-cases` — every case on the challenge (a `medical_pro` sees only their own).
- `GET /api/challenges/:id/validation-rewards` — pool state and per-validator breakdown.

---

## Testing locally

The SSRF guard blocks `localhost` and private addresses by design — including when the endpoint and the app run on the same machine. To test against a model API running locally (e.g. Docker on `localhost:8080`), set in your local `.env`:

```
VALIDATION_ALLOW_PRIVATE_ENDPOINTS=true
```

This skips the private/loopback block entirely. **Local dev only — never set this in production**; it is the one thing standing between a validator and SSRF. See `packages/config/index.ts` and `packages/services/challenge/ssrf-guard.ts`.

`db_data/seed-validation-mammo.ts` seeds a ready-made validation challenge for local work.

---

## Scenario mode

A scenario-mode validation challenge is linked to a `code` source challenge instead of an `ml` one — same `challenges` row shape, same `contribution_points_reward` pool and `cp_per_validation`, but no `required_validations`: there is no quorum to reach, because there is no verdict to reach it toward.

**The scenario.** An ordered list of steps (title + optional instructions), authored at challenge configuration and shared by every exposed application — all contributors built against the same brief, so they face the same walkthrough. **Frozen the moment the first walkthrough starts**, draft or not: `isFrozen` is `runs.length > 0`, not "some run is complete", because a scenario that could still change while someone is mid-walkthrough would change under them. That freeze is what keeps walkthroughs comparable *and* what stops `validation_step_feedbacks.step_id` from ever dangling.

**Exposing an application.** Same admin gesture and same route as ML (`POST /api/challenges/:id/validation-targets`); only the eligible contribution type changes — `project` instead of `api_packaging`. Exposing assumes the team has already deployed the application **and made it embeddable** (see "The iframe" below).

**The walkthrough.**

```
Any signed-in contributor (not the application's own author or group)
  → POST /api/challenges/:id/validation-scenario-runs   { contribution_id }
      idempotent: creates the draft, or returns the one you left, with the
      step feedbacks already recorded. `completed_at IS NULL` is a draft;
      there is no reservation step, so there is no abandoned-walkthrough
      state to clean up.

  → PUT  /api/challenges/:id/validation-scenario-runs/:runId/steps/:stepId
      { result: 'passed' | 'failed' | 'blocked', comment, medical_comment }
      saves as you go, one call per step, upserted — revisiting a step
      overwrites, it never duplicates

  → POST /api/challenges/:id/validation-scenario-runs/:runId/complete
      { global_feedback }
      refuses an empty overall feedback or any unanswered step (returning
      `missingStepIds` so the client can point at them), then stamps
      `completed_at` and writes ONE reward_entries row paying
      cp_per_validation, clamped to the pool
```

**Guards.** Eligible role — `contributor`, `medical_pro` or `admin`; `viewer` is refused (`ValidatorRoleError`, 403), checked in `openWalkthrough` so every route into it inherits the check. Not your own application — checked against `contributions.user_id` **and** `contribution_members`, because `code` challenges support groups of 2-3 sharing one contribution where `user_id` is only the *holder*; ML has no groups, so this guard has no equivalent in the reference-case flow. Re-checked at completion, the same defense-in-depth posture as `castVerdict`. One walkthrough per (validator, application), enforced by a unique index so concurrent requests race safely. The medical comment is gated on the role, not on challenge membership.

**Why the browser calls the application.** The exact inverse of the reference-case flow's rationale, and worth writing down: there is no proxy, no timeout, no size cap and nothing needs an SSRF check at walkthrough time — that guard existed to defend the *server* issuing the request, and here the browser issues it directly to the application in an iframe. The guard at **exposure** time stays, and still buys the useful half: a `javascript:` URL can never be stored and later rendered as a link, and a typo pointing at a private address is caught while the admin is still looking at the form.

**The iframe.** Whether embedding works is decided by `X-Frame-Options` / `CSP: frame-ancestors` from the **contributor's application code** — Django sends `SAMEORIGIN` by default, Express + helmet too, Next.js does not. Since the team deploys these applications itself, making one embeddable is a manual step of putting it online correctly. The platform neither detects nor works around a non-embeddable application; the "open in a tab" button keeps the validator unblocked meanwhile.

**Oversight.** `GET /api/challenges/:id/validation-scenario-runs` (admin/manager) and `ScenarioWalkthroughsPanel`: per application, who walked it, each step result, the comments, the medical opinions and the overall feedback. With no quorum, **this panel is the only quality control in v1.**

---

## Limitations (scenario mode)

- No quorum, no majority, no verdict — every completed walkthrough pays. The
  anti-gaming property the reference-case flow gets from majority payment is replaced by
  nothing but the oversight panel and the fact that feedback is signed and readable. The
  data model can host a quorum later: `result` per step is already a vote that simply is
  not counted.
- No effect on `evaluation_status` / `evaluation` / `globalScore` of the `project`
  contribution, and no reward for its author when the application validates well — CP
  stays entirely on the validator side, unchanged from reference-case mode.
- No automated deployment of the applications under test; deployment stays a manual
  team operation outside the platform.
- No iframe proxy stripping `X-Frame-Options`, and no detection that embedding failed.
- No per-application scenario; no editing a scenario after the first walkthrough; no
  editing a completed walkthrough.
- An application exposed late is walked with the same steps as the others —
  deliberately, otherwise walkthroughs stop being comparable.
- A draft walkthrough may sit forever. Nothing to clean up, nobody blocked.
- Un-exposing a target leaves its walkthroughs intact: they hang off the challenge and
  the contribution, never off `validation_targets`, so removing a target cannot silently
  destroy feedback that has already been paid for.

---

## Limitations (v1)

- Reference-case mode still only covers `ml` challenges' `api_packaging` submissions.
- Reference cases are stored as bytes in Postgres (`bytea`), not in object storage.
- `purgeContentForChallenge` still exists in `validationAttempt.repo.ts` but is no longer wired to challenge archival — **no retention policy is currently applied**, nothing purges stored bytes automatically.
- No automated or scheduled validation — always a manual, human-triggered claim.
- The SSRF guard resolves the endpoint's hostname once before calling it and blocks redirects, but a DNS-rebinding attacker who changes the record between that check and the actual `fetch` could still slip through — a known, accepted gap for an internal tool.
- A target that never gets a single successful (2xx) response can never resolve, even if the endpoint is obviously broken — there is no "N technical failures = broken" path.
- No reward flows to the `api_packaging` author when their submission resolves `works` — CP stays entirely on the validator side.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/database-service/db/drizzle.ts` | `challenges.source_challenge_id` / `cp_per_validation` / `required_validations`, `contributions.live_endpoint_url`, `validation_targets`, `validation_reference_cases`, `validation_case_claims`, `validation_attempts`, `validation_scenario_steps`, `validation_scenario_runs`, `validation_step_feedbacks` |
| `packages/database-service/repositories/referenceCase.repo.ts` | Reference cases — `findExpectedOutputById` is the single enforcement point for "never leaked before reveal" |
| `packages/database-service/repositories/caseClaim.repo.ts` | Claims (null-on-unique-violation under races) |
| `packages/database-service/repositories/validationTarget.repo.ts` | Exposed targets + `resolve()` — shared by both modes |
| `packages/database-service/repositories/validationAttempt.repo.ts` | Verdicts, dedupe-safe |
| `packages/database-service/repositories/scenarioStep.repo.ts` | `ScenarioStepRepository` — the ordered scenario, renumbering on reorder/delete |
| `packages/database-service/repositories/scenarioRun.repo.ts` | `ScenarioRunRepository` — walkthroughs and their step feedbacks, `complete()` gated on `completed_at IS NULL` |
| `packages/services/challenge/reference-case.service.ts` | Authoring, claim+test, observation, reveal — the ordering guarantees |
| `packages/services/challenge/validation-challenge.service.ts` | `castVerdict`, quorum resolution, pool-clamped CP payment |
| `packages/services/challenge/endpoint-proxy.ts` | The proxied call to the contributor's endpoint (reference-case mode only — scenario mode has no proxy) |
| `packages/services/challenge/ssrf-guard.ts` | `assertPublicHttpUrl` — blocks private/loopback/link-local/non-http(s), used at exposure time by both modes and at call time by reference-case mode |
| `packages/services/challenge/validation-mode.ts` | `validationModeFor` — derives `reference_case` / `scenario` from the source challenge's type, the single source of truth for the mode |
| `packages/services/challenge/scenario-guard.ts` | `assertScenarioChallenge` — shared "is this challenge really in scenario mode" check |
| `packages/services/challenge/scenario-steps.service.ts` | Step CRUD + reorder, the freeze check |
| `packages/services/challenge/scenario-walkthrough.service.ts` | Open/resume a run, save a step, complete + pay — the group-aware ownership guard |
| `packages/services/challenge/scenario-errors.ts` | The thirteen typed error classes both scenario services throw |
| `packages/services/challenge/validatorContribution.ts` | `findOrCreateValidatorContribution` — the aggregating `type: 'validation'` contribution, shared by both modes' payment paths |
| `apps/leaderboard-client/src/lib/server/scenarioErrorResponse.ts` | Maps all thirteen scenario error classes to HTTP statuses — one mapping shared by all five scenario routes |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-*/` | Every route in the flows above, both modes |
| `apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx` | Reviewer: claim → observe → reveal → vote (reference-case mode) |
| `apps/leaderboard-client/src/components/challenges/ReferenceCaseAuthorPanel.tsx` | Reviewer: author a reference case |
| `apps/leaderboard-client/src/components/challenges/ValidationOutputViewer.tsx` | Generic image/JSON/text renderer for the endpoint's response |
| `apps/leaderboard-client/src/components/challenges/ScenarioChallengeFlow.tsx` | Validator: pick an application, open or resume its walkthrough (scenario mode) |
| `apps/leaderboard-client/src/components/challenges/ScenarioWalkthroughScreen.tsx` | Validator: the iframe + step panel + progress bar + completion |
| `apps/leaderboard-client/src/components/challenges/scenarioResult.ts` | `passed` / `failed` / `blocked` vocabulary and its display tokens, shared by validator and admin views |
| `apps/leaderboard-client/src/components/challenges/scenarioWalkthroughState.ts` | Pure, unit-tested gating rules for the walkthrough screen (first unanswered step, what blocks "finish") |
| `apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx` | Admin: expose a submission + its endpoint (both modes) |
| `apps/leaderboard-client/src/components/admin/ValidationRunsPanel.tsx` | Admin: every run, with its evidence (reference-case mode) |
| `apps/leaderboard-client/src/components/admin/ReferenceCasesOverviewPanel.tsx` | Admin: case coverage on the challenge |
| `apps/leaderboard-client/src/components/admin/ValidationRewardsPanel.tsx` | Admin: CP pool summary |
| `apps/leaderboard-client/src/components/admin/ScenarioStepsEditor.tsx` | Admin: author and reorder the scenario, disabled once frozen |
| `apps/leaderboard-client/src/components/admin/ScenarioWalkthroughsPanel.tsx` | Admin: every walkthrough, per application (scenario mode oversight) |
