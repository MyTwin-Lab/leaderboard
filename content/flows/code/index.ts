import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { codeFlowDescriptor } from "./descriptor.js";
import { CODE_FLOW_CONFIG_VERSION, codeFlowConfigSchema, codeFlowRules } from "./config.js";
import { codeCreationRepos } from "./repos.js";

export { codeFlowDescriptor } from "./descriptor.js";
export { codeConfigOf, type CodeFlowConfig } from "./config.js";

/** Le handler d'évaluation de la livraison d'un contributeur (ou de son groupe). */
export const CODE_PROJECT_EVALUATION_HANDLER = "project";

// Import à la demande : déclarer le flow ne charge ni le service, ni l'agent, ni le provisioner.
const workspaceActions = () => import("./actions/workspace.js");
const evaluationActions = () => import("./actions/project-evaluation.js");
const joinHooks = () => import("./hooks.js");

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
  // Le livrable `project`, une fois déployé par l'équipe, se parcourt en scénario.
  deliverables: [{ contributionType: "project", capabilities: ["deployed_app"] }],
  // Un board personnel, condition de l'évaluation ; le travail à plusieurs sur une même branche.
  uses: { board: true, groups: true },
  hooks: {
    onCreate: codeCreationRepos,
    onJoin: async (ctx) => (await joinHooks()).provisionWorkspace(ctx),
    onGroupJoin: async (ctx) => (await joinHooks()).reprotectGroupBranch(ctx),
  },
  actions: [
    // Déclarer son propre dépôt (mode own_repo) : un participant du challenge.
    { path: "workspace", method: "PATCH", access: { member: true }, handle: async (ctx) => (await workspaceActions()).setOwnRepo(ctx) },
    // Le service vérifie le board, le workspace et l'appartenance au groupe.
    { path: "project-evaluation", method: "POST", access: {}, handle: async (ctx) => (await evaluationActions()).startProjectEvaluation(ctx) },
  ],
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
