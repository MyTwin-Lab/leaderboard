import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { codeFlowDescriptor } from "./descriptor.js";
import { CODE_FLOW_CONFIG_VERSION, codeFlowConfigSchema, codeFlowRules } from "./config.js";

export { codeFlowDescriptor } from "./descriptor.js";
export { codeConfigOf, type CodeFlowConfig } from "./config.js";

/** Le handler d'évaluation de la livraison d'un contributeur (ou de son groupe). */
export const CODE_PROJECT_EVALUATION_HANDLER = "project";

/**
 * Flow code — chaque contributeur (ou groupe) livre un projet sur sa branche,
 * évalué par la grille `code` une fois son board terminé, et payé sur le pool
 * du challenge (`services/challenge/code-rewards.service.ts`, `reward.ts`).
 *
 * La définition déclare sa configuration, ses règles, ce qu'il écrit dans le
 * ledger et dans `contributions`, et comment rejouer une évaluation échouée.
 * Le reste de son code n'a pas encore rejoint ce dossier.
 */
export const codeFlow: FlowDefinition = {
  descriptor: codeFlowDescriptor,
  config: { version: CODE_FLOW_CONFIG_VERSION, schema: codeFlowConfigSchema },
  rules: codeFlowRules,
  ruleKeys: [
    { key: "code_fixed", consumesPool: true },
    { key: "code_quality", consumesPool: true },
  ],
  contributionTypes: [{ key: "project", countsAsContribution: true }],
  evaluationHandlers: [
    {
      key: CODE_PROJECT_EVALUATION_HANDLER,
      // Mêmes préconditions que le bouton du contributeur : le rejeu reprend
      // le run par le compare-and-set, puis évalue en tâche de fond.
      async retry(payload) {
        const { challengeId, userId } = payload;
        if (typeof challengeId !== "string" || typeof userId !== "string") {
          return { ok: false, reason: "invalid_payload" };
        }

        // Import à la demande : déclarer le flow ne charge ni l'agent ni les connecteurs.
        const { CodeRewardsService } = await import("../../../packages/services/challenge/code-rewards.service.js");
        const service = new CodeRewardsService();
        const event = { challengeId, userId };

        const claimed = await service.claim(event);
        if (!claimed.ok) return { ok: false, reason: claimed.reason ?? "cannot_evaluate" };
        service.scheduleRun(event);
        return { ok: true };
      },
    },
  ],
};
