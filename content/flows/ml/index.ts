import { z } from "zod";
import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { parseMlRewardRules } from "../../../packages/database-service/domain/mlRewardRules.js";
import { mlFlowDescriptor } from "./descriptor.js";
import { mlCreationRepos } from "./repos.js";
import { MODEL_METRIC_RULE_KEY } from "./metric.js";
import { ML_PUBLIC_REWARD_FIELDS, summarizeMlRewards } from "./rewards.js";

export { mlFlowDescriptor } from "./descriptor.js";
export { MODEL_METRIC_META_FIELD, MODEL_METRIC_RULE_KEY } from "./metric.js";

/** Le handler d'évaluation d'une soumission (dataset, code du modèle, packaging d'API). */
export const ML_SUBMISSION_EVALUATION_HANDLER = "submission";

// Import à la demande : déclarer le flow ne charge ni les repositories ni l'agent.
const workspaceActions = () => import("./actions/workspace.js");

/**
 * Configuration du flow ML, version 1 : aucune clé propre. Ce qui se règle sur
 * un challenge ML appartient aux extensions (la puissance de calcul) ou aux
 * règles de récompense, éditables.
 */
export const mlFlowConfigSchema = z.object({});

/**
 * Flow ML — soumissions de dataset, de modèle, de code du modèle et de
 * packaging d'API, notées au fil de l'eau et payées sur le pool du challenge
 * (`services/challenge/ml-rewards.service.ts`, `reward.ts`).
 *
 * La définition déclare sa configuration, ses règles, ce qu'il écrit dans le
 * ledger et dans `contributions`, et comment rejouer une évaluation échouée.
 * Le reste de son code n'a pas encore rejoint ce dossier.
 */
export const mlFlow: FlowDefinition = {
  descriptor: mlFlowDescriptor,
  config: { version: 1, schema: mlFlowConfigSchema },
  rules: { parse: parseMlRewardRules },
  // La métrique du modèle et le seuil qui ferme les soumissions, lus par la page du challenge.
  rewards: { summarize: summarizeMlRewards, publicFields: ML_PUBLIC_REWARD_FIELDS },
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
  // Le packaging d'API expose un endpoint qu'une validation peut éprouver.
  deliverables: [{ contributionType: "api_packaging", capabilities: ["endpoint"] }],
  // Rejoindre en groupe reste possible, comme avant la déclaration.
  uses: { groups: true },
  hooks: { onCreate: mlCreationRepos },
  // Un challenge ML n'a pas de join préalable : soumettre une étape fait entrer
  // dans l'équipe. Lire et soumettre restent donc ouverts à tout compte connecté.
  actions: [
    { path: "workspace", method: "GET", access: {}, handle: async (ctx) => (await workspaceActions()).readWorkspace(ctx) },
    { path: "workspace", method: "PATCH", access: {}, handle: async (ctx) => (await workspaceActions()).submitWorkspace(ctx) },
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
