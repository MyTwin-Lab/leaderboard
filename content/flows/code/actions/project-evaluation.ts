import type { ActionContext } from "../../../../packages/registry/platform.js";
import { CodeRewardsService } from "../../../../packages/services/challenge/code-rewards.service.js";

function refusal(reason: string | undefined) {
  const status = reason === "already_running" ? 409 : 400;
  return Response.json({ error: "Cannot start evaluation", reason }, { status });
}

/**
 * `POST project-evaluation` — lance l'évaluation globale du board personnel de
 * l'appelant (ou de son groupe). Fire-and-forget : le statut vit sur la
 * contribution `project`, que l'interface interroge.
 */
export async function startProjectEvaluation({ challenge, user }: ActionContext) {
  const service = new CodeRewardsService();
  const check = await service.canEvaluate(challenge.uuid, user.id);
  if (!check.ok) return refusal(check.reason);

  // Le passage à `running` est un compare-and-set attendu ici, avant le 202 :
  // un second lancement concurrent reçoit 409 au lieu de planifier un second
  // run (et un second appel LLM).
  const event = { challengeId: challenge.uuid, userId: user.id };
  const claim = await service.claim(event);
  if (!claim.ok) return refusal(claim.reason);

  service.scheduleRun(event);
  return Response.json({ scheduled: true }, { status: 202 });
}
