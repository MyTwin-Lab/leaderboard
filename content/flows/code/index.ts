import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { codeFlowDescriptor } from "./descriptor.js";

export { codeFlowDescriptor } from "./descriptor.js";

/**
 * Flow code — chaque contributeur (ou groupe) livre un projet sur sa branche,
 * évalué par la grille `code` une fois son board terminé, et payé sur le pool
 * du challenge (`services/challenge/code-rewards.service.ts`,
 * `evaluator/code-reward.ts`).
 *
 * La définition déclare ce que le flow écrit dans le ledger et dans
 * `contributions`. Son code n'a pas encore rejoint ce dossier.
 */
export const codeFlow: FlowDefinition = {
  descriptor: codeFlowDescriptor,
  ruleKeys: [
    { key: "code_fixed", consumesPool: true },
    { key: "code_quality", consumesPool: true },
  ],
  contributionTypes: [{ key: "project", countsAsContribution: true }],
};
