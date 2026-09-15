import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { mlFlowDescriptor } from "./descriptor.js";

export { mlFlowDescriptor } from "./descriptor.js";

/** La clé qui porte la métrique d'un modèle, et le champ de `meta` où elle vit. */
export const MODEL_METRIC_RULE_KEY = "model_metric";
export const MODEL_METRIC_META_FIELD = "metricValue";

/** Le handler d'évaluation d'une soumission (dataset, code du modèle, packaging d'API). */
export const ML_SUBMISSION_EVALUATION_HANDLER = "submission";

/**
 * Flow ML — soumissions de dataset, de modèle, de code du modèle et de
 * packaging d'API, notées au fil de l'eau et payées sur le pool du challenge
 * (`services/challenge/ml-rewards.service.ts`, `reward.ts`).
 *
 * La définition déclare ce que le flow écrit dans le ledger et dans
 * `contributions`, et comment rejouer une évaluation échouée. Le reste de son
 * code n'a pas encore rejoint ce dossier.
 */
export const mlFlow: FlowDefinition = {
  descriptor: mlFlowDescriptor,
  ruleKeys: [
    { key: "dataset", consumesPool: true, label: "Dataset quality" },
    { key: MODEL_METRIC_RULE_KEY, consumesPool: true, label: "Model metric" },
    { key: "model_code", consumesPool: true, label: "Model code" },
    { key: "beat_best", consumesPool: true, label: "Best model bonus" },
    { key: "api_packaging", consumesPool: true, label: "API packaging" },
    { key: "reuse_dataset", consumesPool: true, label: "Dataset reuse" },
    { key: "reuse_model", consumesPool: true, label: "Model reuse" },
  ],
  // `model_code` alimente la contribution `model` (voir `ML_ROLE_RULE`).
  contributionTypes: [
    { key: "dataset", countsAsContribution: true },
    { key: "model", countsAsContribution: true },
    { key: "api_packaging", countsAsContribution: true },
  ],
  evaluationHandlers: [
    {
      key: ML_SUBMISSION_EVALUATION_HANDLER,
      // Rejoue l'attribution de la soumission : seul un run échoué se rejoue,
      // et un run échoué n'a écrit aucune ligne de ledger.
      async retry(payload) {
        const { challengeId, userId, repoId, url } = payload;
        if ([challengeId, userId, repoId, url].some((value) => typeof value !== "string")) {
          return { ok: false, reason: "invalid_payload" };
        }

        // Import à la demande : déclarer le flow ne charge ni l'agent ni les connecteurs.
        const { MlRewardsService } = await import("../../../packages/services/challenge/ml-rewards.service.js");
        new MlRewardsService().scheduleAward({
          challengeId: challengeId as string,
          userId: userId as string,
          repoId: repoId as string,
          url: url as string,
        });
        return { ok: true };
      },
    },
  ],
};
