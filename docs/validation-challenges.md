# Validation Challenges

`type: 'validation'` challenges let contributors manually test whether a submitted ML API packaging actually works — drop a file, call the live deployed endpoint, see the raw output, then vote **Fonctionne** or **Défectueux**. Once a submission collects a fixed number of votes, the majority side is paid CP from the validation challenge's own pool; the minority gets nothing. It's a human sanity-check tool, separate from AI scoring.

**Requires:** nothing beyond the base app — no AI, no external credentials. The endpoint being validated must be publicly reachable over HTTP(S).

---

## Why a separate system

Today an `ml` challenge's "API packaging" step is scored purely by AI-grading the packaging *code* (against the code grid, same as any other code submission) — nobody actually calls the deployed model to see if it works. A **validation challenge** adds that missing piece: a human drops a test file, the platform proxies it to the contributor's live endpoint, and shows the model's actual output.

This is deliberately **not** an automated grader. It doesn't touch `evaluation_status`, `evaluation`, or `globalScore` on the source contribution at all — it's a fully separate mechanism with its own CP pool, for a fully separate purpose (does it work?, not how good is the code?).

---

## How it works

A validation challenge is a `challenges` row with `type: 'validation'`, linked 1:1 to an existing `ml` "work challenge" via `source_challenge_id`. It has its own `contribution_points_reward` (CP pool) and its own `cp_per_validation` (fixed CP a validator earns per first-time validation) — both set once at creation and locked afterward, same as an ML challenge's pool/project.

```
Contributor (ML workspace, API packaging step)
  → submits GitHub repo URL (as before) + optionally a "Deployed API endpoint" URL
       ↓ saved to contributions.live_endpoint_url

Admin (validation challenge config)
  → picks which api_packaging contributions (that have a live endpoint) to expose
       ↓ creates a validation_targets row per submission

Validator (any logged-in contributor, on the validation challenge page)
  → drops a file on an exposed target
    → POST /api/challenges/:id/validate  (multipart: contribution_id, file)
      → server verifies the target is exposed
      → server SSRF-guards the endpoint URL (blocks private/loopback/link-local
        addresses, blocks redirects, enforces a 15s timeout and a 10MB response cap)
      → server proxies the file to the endpoint, returns the raw response
    → client renders the response generically: image/* → <img>, JSON → pretty
      field-by-field viewer (with base64/data-URI image fields shown inline),
      anything else → raw text
  → validator casts a verdict based on what they saw
    → POST /api/challenges/:id/validation-verdicts  { contribution_id, verdict, description }
      → rejects a self-vote (can't vote on your own submission) or a second vote
        from the same validator on the same target
      → once the target has collected `required_validations` verdicts, it
        resolves permanently: majority wins, and every validator on the
        majority side is paid `cp_per_validation` (minority gets nothing)
```

The browser never calls the contributor's deployed endpoint directly — third-party deployments (HuggingFace Spaces, Render, etc.) generally won't have CORS configured for this app's origin, and a client-side "I got a valid response" claim would be unverifiable and would make the CP award trivially spoofable. The server is the one that observes the response, so it's the one that decides whether CP is earned.

## Rewards: fixed, from the validation challenge's own pool

Unlike Slack discussion signals (fixed, but explicitly *outside* the ML pool), validation rewards drain the **validation challenge's own** pool — a validation challenge is a `challenges` row like any other, so it gets its own budget and its own `reward_entries` (`rule_key: 'validation'`).

- Each validation challenge sets `cp_per_validation` (CP per validator, on the winning side) and `required_validations` (an odd number — how many verdicts a target needs before it resolves) once at creation; both are locked afterward.
- CP is paid only once a target resolves — never per individual call. Only validators whose verdict matches the resolved majority get paid; the minority earns nothing, even though they did the same work of testing.
- One `type: 'validation'` contribution per validator per validation challenge aggregates the ledger, mirroring the `type: 'discussion'` pattern used for Slack signals — a chip, not a contribution-list entry.
- Before a target resolves, everyone sees only a blind participation count ("3/5 validations reçues") — never the works/broken split. The challenge's admin/manager is the one exception, seeing the live split for oversight.
- A failed proxied call (timeout, non-2xx, SSRF-blocked, redirect) records no verdict and no quorum progress — the validator can retry.
- A target that never collects enough votes just stays unresolved — no CP paid, no error.
- Repeat testing of an already-resolved target is allowed (useful for sanity-checking again) — it just earns no further CP and doesn't affect the permanent outcome.

---

## Setting it up

1. **Contributor side:** in an `ml` challenge's ML workspace, on the "API Packaging" step, fill in the optional "Deployed API endpoint" field alongside the GitHub repo URL (requires the GitHub URL to already be submitted — that's what creates the `api_packaging` contribution the endpoint attaches to).
2. **Admin/manager side:** create a new challenge with type "Validation", pick the source `ml` challenge (one validation challenge per ML challenge — the API rejects a second one), set the CP pool and CP-per-validation rate. Then, editing the challenge, use the "Validation targets" section to pick which eligible `api_packaging` submissions (those with a saved endpoint) to expose.
3. **Anyone:** open the validation challenge page, drop a file on an exposed submission, see the output.

---

## Testing locally

The SSRF guard blocks `localhost` and private addresses by design — including when the endpoint and the app are running on the same machine. To test with a model API running locally (e.g. in Docker on `localhost:8080`), set in your local `.env`:

```
VALIDATION_ALLOW_PRIVATE_ENDPOINTS=true
```

This skips the private/loopback block entirely. **Local dev only — never set this in production**; it's the one thing standing between a validator and SSRF. See `packages/config/index.ts` and `packages/services/challenge/ssrf-guard.ts`.

## Limitations (v1)

- Only `ml` challenges' `api_packaging` submissions — no other submission type, and no path to extend this to `code` challenges yet.
- No persisted history: neither the uploaded file nor the API's response is stored anywhere — only that a validation happened (validator, target, timestamp), for CP dedupe and audit.
- No automated or scheduled validation — always a manual, human-triggered drop.
- The SSRF guard resolves the endpoint's hostname once before calling it and blocks redirects, but a DNS-rebinding attacker who changes the record between that check and the actual `fetch` call could still slip through — a known, accepted gap for an internal tool, not something this guard tries to close.
- Metrics/output correctness is exactly whatever the endpoint returns and what validators judge — nothing here verifies the model's output against a ground truth.
- A target that never gets a single successful (2xx) response can never resolve, even if the endpoint is obviously broken — there's no "N technical failures = broken" path.
- No reward or recognition flows to the `api_packaging` contribution's author when their submission resolves `works` — CP in this system stays entirely on the validator side.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/database-service/db/drizzle.ts` | `challenges.source_challenge_id` / `cp_per_validation`, `contributions.live_endpoint_url`, `validation_targets`, `validation_attempts` |
| `packages/database-service/repositories/validationTarget.repo.ts` | CRUD for exposed targets |
| `packages/database-service/repositories/validationAttempt.repo.ts` | Dedup-safe attempt recording (`create` returns `null` on a unique-violation race) |
| `packages/services/challenge/ssrf-guard.ts` | `assertPublicHttpUrl` — blocks private/loopback/link-local/non-http(s) targets |
| `packages/services/challenge/validation-challenge.service.ts` | Orchestrates the proxy call, dedupe, and pool-clamped CP award |
| `apps/leaderboard-client/src/app/api/challenges/route.ts` | Challenge creation, including `type: 'validation'` validation and 1:1 enforcement |
| `apps/leaderboard-client/src/app/api/challenges/[id]/ml-workspace/route.ts` | The `live_endpoint_url` field on the API packaging step |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts` | List exposed targets / eligible submissions, add a target |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/[targetId]/route.ts` | Remove a target |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validate/route.ts` | The proxy endpoint contributors hit when dropping a file |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-verdicts/route.ts` | Casts a verdict; resolves the target and pays the majority once quorum is reached |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-rewards/route.ts` | Pool state + per-validator breakdown, admin/manager only |
| `apps/leaderboard-client/src/components/admin/ValidationRewardsPanel.tsx` | Admin: CP pool summary for a validation challenge |
| `apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx` | Admin: pick which submissions to expose |
| `apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx` | Contributor: dropzone per exposed target |
| `apps/leaderboard-client/src/components/challenges/ValidationOutputViewer.tsx` | Generic image/JSON/text renderer for the API's response |
