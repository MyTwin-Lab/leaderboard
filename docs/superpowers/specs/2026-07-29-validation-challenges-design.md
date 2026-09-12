# Validation Challenges — Design

## Purpose

Today, ML challenges score the "API packaging" step purely by AI-grading the packaging *code* (against the code grid) — nobody actually calls the deployed model to see if it works. **Validation challenges** add a new, separate mechanism: a human drops a test file, the platform calls the contributor's live deployed API with it, and shows the raw model output in a simplified viewer (text, JSON, or image). This is a manual sanity-check tool, not an automated grader — it does not touch AI scoring — but performing a validation itself earns the validator a fixed amount of CP, funded from its own pool.

v1 scope is explicitly limited to ML challenges' `api_packaging` submissions. The mechanism is generic enough to extend to other submission types later, but that's out of scope now.

## Core concepts

| Concept | Description |
|---|---|
| **Validation challenge** | A new `challenges.type = 'validation'` row, linked 1:1 to an existing ML "work challenge" via `source_challenge_id`. Has its own CP pool and its own `cp_per_validation` rate. Created and configured by an admin. |
| **Validation target** | One `api_packaging` contribution from the source challenge, explicitly selected by the admin to be exposed for validation. Only contributions with a `live_endpoint_url` are eligible. |
| **Validation attempt** | A record that a given validator has tested a given target at least once. Enforces "CP once per (validator, target)" — repeat testing is allowed, repeat CP is not. |
| **Validator** | Any logged-in contributor. Not restricted to the source challenge's team. |

## Data model changes

### `challenges` (existing table)

- `type` gains a new value: `'validation'` (alongside `'code'` / `'ml'`).
- New nullable column `source_challenge_id uuid references challenges.uuid` — the linked ML work challenge. Enforced 1:1 at the service layer (a source challenge can back at most one validation challenge).
- Reuses `contribution_points_reward` as the validation challenge's total CP budget.
- Reuses `reward_rules` (JSON) to store `{ cp_per_validation: number }`.

### `contributions` (existing table)

- New nullable column `live_endpoint_url varchar(500)` — the contributor's deployed API endpoint, distinct from the existing `artifact_url` (which holds the GitHub packaging repo URL). Only meaningful for `type: 'api_packaging'` contributions.
- Populated via a new optional field on the existing ML workspace "API packaging" step (`PATCH /api/challenges/:id/ml-workspace`), submitted alongside the GitHub repo URL, not through a separate flow.

### `validation_targets` (new table)

```
uuid                    pk
validation_challenge_id fk -> challenges.uuid, cascade
contribution_id         fk -> contributions.uuid, cascade   -- the api_packaging contribution exposed
position                integer                              -- display order
```

Admin-managed: which eligible `api_packaging` contributions (from the linked source challenge) are exposed on this validation challenge.

### `validation_attempts` (new table)

```
uuid                    pk
validation_challenge_id fk -> challenges.uuid, cascade
contribution_id         fk -> contributions.uuid, cascade   -- the target validated
validator_user_id       fk -> users.uuid, cascade
created_at              timestamp default now()

unique (validation_challenge_id, contribution_id, validator_user_id)
```

No file content or API response body is ever stored — only enough to dedupe CP and give an audit trail (who validated what, when).

### `reward_entries` (existing ledger, no schema change)

- New `rule_key: 'validation'`.
- `challenge_id` = the validation challenge (not the source ML challenge) — so `MlRewardsService.remainingPool`-style budget tracking and the leaderboard's per-challenge aggregation work unmodified.
- One row per successful, first-time `(validator, target)` pair, `points = cp_per_validation` (clamped to whatever remains in the validation challenge's pool, same clamping behavior as ML rewards).
- Attributed to a single aggregate `type: 'validation'` contribution per validator per validation challenge — mirrors the existing `type: 'discussion'` pattern used for Slack signals (chips on the profile, ledger rows are the source of truth, no contribution-list clutter).

## Request flow

```
Browser: drop file on a validation target
  → POST /api/validation-challenges/:id/validate  { contributionId, file }  (multipart)
    → verify: challenge is type='validation', contribution is a validation_target of it,
      contribution.live_endpoint_url is set
    → SSRF guard the endpoint URL:
        - scheme must be http/https
        - resolved IP must not be private/loopback/link-local/metadata (169.254.169.254 etc.)
    → proxy the file to live_endpoint_url (multipart POST), with a timeout (~15s)
      and a capped response size (~10MB)
    → on 2xx response:
        - if no validation_attempts row exists for (validation_challenge_id, contribution_id,
          validator_user_id): insert one, and award CP via reward_entries (clamped to
          remaining pool)
        - return { output: <raw response, content-type preserved>, cpAwarded: boolean,
          alreadyValidated: boolean }
    → on error/timeout/non-2xx: return the failure to the client; no attempt row, no CP
  → Browser renders `output` generically by content-type:
      - image/*        → <img>
      - application/json → pretty-printed viewer; a field that looks like a base64/data-URI
        image is rendered as an image inline
      - anything else   → raw text
```

The browser never calls the contributor's endpoint directly — CORS on arbitrary third-party deployments can't be relied on, and self-reported "it worked" claims from the client would make the CP award unverifiable. The server is the one that observes the response, so it's the one that decides whether CP is earned.

## UI

- **Admin (challenge edit / creation):** pick the source ML challenge (must not already have a linked validation challenge), set the CP pool and `cp_per_validation`, then select which eligible `api_packaging` contributions (those with a `live_endpoint_url`) to expose as validation targets.
- **ML workspace, "API packaging" step:** a new optional field, "Deployed API endpoint", next to the existing GitHub repo URL field.
- **Validation challenge page (any contributor):** list of exposed targets (contributor name/avatar, maybe endpoint host). Opening one shows a dropzone; on drop, a loading state, then the rendered output. A visible "already validated by you" badge once a `validation_attempts` row exists, but the dropzone stays usable for repeat manual testing.

## Error handling

- Endpoint unreachable / times out / non-2xx: shown as a clear failure state in the UI ("the API didn't respond correctly"), no CP, no attempt recorded — the validator can retry.
- SSRF-blocked URL: this shouldn't normally surface to a validator (the admin should never have been able to select a target whose endpoint fails validation at submission time — the ML workspace field itself does a basic reachability/scheme check on save), but the proxy re-checks at call time as defense in depth.

## Out of scope (v1)

- Anything other than ML `api_packaging` submissions.
- Persisted history of past validation files/responses.
- Any automated or scheduled validation runs — always a manual, human-triggered action.
- Any effect on AI-driven scoring — this is fully separate from `evaluation_status`/`evaluation`/`globalScore`.
