import type { ActionContext } from "../../../packages/registry/platform.js";
import type { ComputeRequest } from "../../../packages/database-service/domain/entities.js";
import { ComputeRequestRepository, UserRepository } from "../../../packages/database-service/repositories/index.js";
import { ComputeRequestService } from "../../../packages/services/compute/compute-request.service.js";

/**
 * Actions de l'extension compute. L'accès est déclaré dans `index.ts` ; ici,
 * seulement ce qui tient à la demande elle-même (à qui elle appartient, dans
 * quel état elle est).
 */

const computeRequestRepo = new ComputeRequestRepository();
const userRepo = new UserRepository();
const computeRequestService = new ComputeRequestService();

function toClientShape(request: ComputeRequest | null) {
  if (!request) return null;
  // Jamais access_token_enc/iv : le token ne sort que par `request/reveal-token`.
  return {
    id: request.uuid,
    status: request.status,
    requested_at: request.requested_at,
    approved_at: request.approved_at,
    expires_at: request.expires_at,
    ready_at: request.ready_at,
    expired_at: request.expired_at,
    error_message: request.error_message,
  };
}

/** `GET request` — la demande de l'appelant sur ce challenge, s'il en a une. */
export async function ownRequest({ challenge, user }: ActionContext) {
  const request = await computeRequestRepo.findByChallengeAndUser(challenge.uuid, user.id);
  return { request: toClientShape(request) };
}

/** `POST request` — demander une instance GPU. */
export async function requestCompute({ challenge, user }: ActionContext) {
  const result = await computeRequestService.requestCompute(challenge.uuid, user.id);
  if ("error" in result) {
    const status = result.error === "already_requested" ? 409 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ request: toClientShape(result.request) }, { status: 201 });
}

/**
 * `POST request/reveal-token` — le token Jupyter de sa propre instance,
 * consultable tant qu'elle est prête (voir `ComputeRequestService.revealToken`).
 */
export async function revealToken({ challenge, user }: ActionContext) {
  const existing = await computeRequestRepo.findByChallengeAndUser(challenge.uuid, user.id);
  if (!existing || existing.user_id !== user.id) {
    return Response.json({ error: "Compute request not found" }, { status: 404 });
  }

  try {
    const { token, jupyterUrl } = await computeRequestService.revealToken(existing.uuid, user.id);
    return { token, jupyter_url: jupyterUrl };
  } catch (error: any) {
    return Response.json({ error: error?.message ?? "Failed to reveal token" }, { status: 400 });
  }
}

/** `GET requests` — toutes les demandes du challenge, sans aucun token. */
export async function listRequests({ challenge }: ActionContext) {
  const requests = await computeRequestRepo.findByChallenge(challenge.uuid);
  const requesters = await userRepo.findByIds([...new Set(requests.map((r) => r.user_id))]);
  const requestersById = new Map(requesters.map((u) => [u.uuid, u]));

  return {
    requests: requests.map((r) => ({
      id: r.uuid,
      requesterName: requestersById.get(r.user_id)?.full_name ?? "Unknown",
      status: r.status,
      requested_at: r.requested_at,
      decided_at: r.decided_at,
      approved_at: r.approved_at,
      expires_at: r.expires_at,
      error_message: r.error_message,
    })),
  };
}

/** `POST requests/:requestId/decision` — body `{ decision: 'approve' | 'reject' | 'retry' }`. */
export async function decide({ request, params, user }: ActionContext) {
  let decision: unknown;
  try {
    decision = (await request.json()).decision;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (decision === "approve" || decision === "reject") {
      const updated = await computeRequestService.decide(params.requestId, user.id, decision);
      return { status: updated.status };
    }
    if (decision === "retry") {
      await computeRequestService.retryProvisioning(params.requestId);
      return { status: "provisioning" };
    }
    return Response.json({ error: 'decision must be "approve", "reject" or "retry"' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error?.message ?? "Failed to process decision" }, { status: 400 });
  }
}
