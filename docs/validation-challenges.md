# Validation Challenges

`type: 'validation'` challenges let qualified reviewers check whether a submitted ML API packaging actually works — but not by improvising a test. A reviewer claims a **ground-truth reference case** (a known input with a known expected output, written by another qualified reviewer), the platform calls the live endpoint with that exact input, the reviewer **writes down what they saw**, and only then may they see the expected output. They then vote **works** or **broken**. Once a submission collects a fixed number of verdicts, the majority side is paid CP from the validation challenge's own pool; the minority gets nothing.

**Requires:** at least one user with the `medical_pro` role. No AI, no external credentials — but the endpoint being validated must be publicly reachable over HTTP(S).

---

## Why a separate system

An `ml` challenge's "API packaging" step is scored purely by AI-grading the packaging *code* — nobody actually calls the deployed model to see if it works. A validation challenge adds that missing piece.

It is deliberately **not** an automated grader. It never touches `evaluation_status`, `evaluation`, or `globalScore` on the source contribution — it is a fully separate mechanism with its own CP pool, answering a different question (*does it work?*, not *how good is the code?*).

The reference-case machinery exists to answer a second question: *can we trust the verdict?* A reviewer who invents their own test input and sees the answer first has no way to be wrong. Ground truth authored by someone else, plus a mandatory written observation before the reveal, is what makes a verdict mean something.

---

## The `medical_pro` role

Validation is gated on a dedicated role — `users.role = 'medical_pro'` — not on challenge membership. Only a `medical_pro` can author a reference case, claim one, record an observation, reveal an expected output, or cast a verdict. Admins and project managers get oversight (they can read every case and every run) but **cannot** author cases or vote: authorship is a qualification boundary, not a permission level.

The role is assigned by an admin in `/admin/users`. See [`auth.md`](./auth.md#roles).

---

## How it works

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

## Limitations (v1)

- Only `ml` challenges' `api_packaging` submissions — no other submission type, and no path to `code` challenges yet.
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
| `packages/database-service/db/drizzle.ts` | `challenges.source_challenge_id` / `cp_per_validation` / `required_validations`, `contributions.live_endpoint_url`, `validation_targets`, `validation_reference_cases`, `validation_case_claims`, `validation_attempts` |
| `packages/database-service/repositories/referenceCase.repo.ts` | Reference cases — `findExpectedOutputById` is the single enforcement point for "never leaked before reveal" |
| `packages/database-service/repositories/caseClaim.repo.ts` | Claims (null-on-unique-violation under races) |
| `packages/database-service/repositories/validationTarget.repo.ts` | Exposed targets + `resolve()` |
| `packages/database-service/repositories/validationAttempt.repo.ts` | Verdicts, dedupe-safe |
| `packages/services/challenge/reference-case.service.ts` | Authoring, claim+test, observation, reveal — the ordering guarantees |
| `packages/services/challenge/validation-challenge.service.ts` | `castVerdict`, quorum resolution, pool-clamped CP payment |
| `packages/services/challenge/endpoint-proxy.ts` | The proxied call to the contributor's endpoint |
| `packages/services/challenge/ssrf-guard.ts` | `assertPublicHttpUrl` — blocks private/loopback/link-local/non-http(s) |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-*/` | Every route in the flow above |
| `apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx` | Reviewer: claim → observe → reveal → vote |
| `apps/leaderboard-client/src/components/challenges/ReferenceCaseAuthorPanel.tsx` | Reviewer: author a reference case |
| `apps/leaderboard-client/src/components/challenges/ValidationOutputViewer.tsx` | Generic image/JSON/text renderer for the endpoint's response |
| `apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx` | Admin: expose a submission + its endpoint |
| `apps/leaderboard-client/src/components/admin/ValidationRunsPanel.tsx` | Admin: every run, with its evidence |
| `apps/leaderboard-client/src/components/admin/ReferenceCasesOverviewPanel.tsx` | Admin: case coverage on the challenge |
| `apps/leaderboard-client/src/components/admin/ValidationRewardsPanel.tsx` | Admin: CP pool summary |
