# GPU Compute Power

An `ml` challenge can offer its contributors a **temporary GPU instance** (Scaleway) to train their model, without anyone handing out cloud credentials. A contributor asks, a manager approves, the platform provisions a JupyterLab instance and hands back a one-click link. The instance dies 24 hours later, automatically.

**Requires:** a Scaleway account connected by an admin (see [`admin-settings.md`](./admin-settings.md#scaleway)) and `compute_enabled` turned on for the challenge.

---

## Why it exists

ML challenges ask contributors to train models, which most of them cannot do on a laptop. Giving each of them a cloud account is not an option — billing, credentials, and forgotten instances all become somebody's problem. Instead, the platform owns one Scaleway project, mediates every request, and guarantees the instance disappears.

---

## The flow

```
Contributor (ML challenge page, "GPU compute power" panel)
  → POST /api/challenges/:id/compute-request
    → creates a `pending` row (one per challenge/contributor, enforced by a unique index)
    → also makes them a challenge member if they weren't already, like an ML submission does

Admin / project manager (manage view, compute requests panel)
  → POST /api/challenges/:id/compute-requests/:requestId/decision  { decision: 'approve' | 'reject' | 'retry' }
    → 'reject' ends it there
    → 'approve' sets expires_at = now + 24h and fires provisioning (fire-and-forget:
       creating an instance takes minutes, far beyond an HTTP request's budget)

Cron: GET /api/cron/compute-provisioning  (every minute)
  → polls Scaleway for instances still `provisioning`
  → once the instance answers, re-derives its reachable JupyterLab URL and flips the row to `ready`

Contributor
  → POST /api/challenges/:id/compute-request/reveal-token
    → returns the JupyterLab URL + access token, as many times as needed while `ready`
      (not burn-after-read — losing the tab shouldn't cost you the instance)

Cron: GET /api/cron/compute-expiration  (every minute)
  → terminates every instance past its expires_at, sets `expired` with expire_reason 'timeout'
```

Closing or deleting the challenge also terminates its instances (`expire_reason: 'challenge_closed'` / `'challenge_deleted'`).

---

## Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Requested, waiting on a manager's decision |
| `rejected` | The manager declined |
| `approved` | Accepted — the instance is being created |
| `provisioning` | Scaleway is building the instance |
| `ready` | JupyterLab is reachable; the countdown to `expires_at` is running |
| `expired` | Terminated — see `expire_reason` (`timeout` / `challenge_closed` / `challenge_deleted`) |
| `failed` | Provisioning failed; `error_message` says why, and a manager can `retry` |

---

## Guarantees and limits

- **One request per contributor per challenge.** Enforced by a unique index on `(challenge_id, user_id)`, not just a service-layer check — concurrent requests can't slip through.
- **24 hours, fixed at approval.** `expires_at` is set once and never extended, by anything.
- **The access token never leaves the row unencrypted.** It is stored AES-256-GCM-encrypted (`access_token_enc` / `access_token_iv`); `jupyter_base_url` deliberately never contains the token. The admin/manager listing of requests excludes the token entirely.
- **Default instance:** `L4-1-24G`. The ML toolchain is expected to already be on the marketplace image — nothing is installed at provisioning time.
- The panel is hidden entirely when no Scaleway account is connected, rather than offering a button that cannot work.
- **Disconnecting Scaleway is a soft disconnect.** It blocks new requests and approvals immediately, but instances already running live out their 24h and are still terminated by the cron — `getScalewayCredentials()` deliberately ignores the disconnect flag for exactly that reason, while `isScalewayUserFacingConnected()` honours it. See [`admin-settings.md`](./admin-settings.md#scaleway).

---

## Key files

| File | Purpose |
|------|---------|
| `packages/scaleway/client.ts` | Thin Scaleway Instances API client (create, get, delete, testConnection) |
| `packages/provisioner/src/providers/scaleway-gpu.provider.ts` | GPU instance provider (`L4-1-24G` default) |
| `packages/services/compute/compute-request.service.ts` | Request → decision → provisioning → reveal → expiry orchestration |
| `packages/services/compute/cron-check-provisioning.ts` | Polls instances still provisioning |
| `packages/services/compute/cron-expire-instances.ts` | Terminates expired instances |
| `packages/config/scalewayCredentials.ts` | Encrypted credential access (DB only — no `.env` fallback) |
| `packages/database-service/repositories/computeRequest.repo.ts` | `compute_requests` CRUD |
| `apps/leaderboard-client/src/app/api/challenges/[id]/compute-request/` | Contributor: request, read own, reveal token |
| `apps/leaderboard-client/src/app/api/challenges/[id]/compute-requests/` | Admin/manager: list + decision |
| `apps/leaderboard-client/src/app/api/cron/compute-provisioning/` | Provisioning poll cron |
| `apps/leaderboard-client/src/app/api/cron/compute-expiration/` | Expiry sweep cron |
| `apps/leaderboard-client/src/components/challenges/ComputeRequestPanel.tsx` | Contributor panel |
| `apps/leaderboard-client/src/components/challenges/ComputeRequestsPanel.tsx` | Admin/manager review panel |
| `apps/leaderboard-client/src/components/contributor/ScalewayConnectionCard.tsx` | Admin connection card |
