import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { mlFlowDescriptor } from "./descriptor.js";

export { mlFlowDescriptor } from "./descriptor.js";

/**
 * Flow ML — soumissions de dataset, de modèle, de code du modèle et de
 * packaging d'API, notées au fil de l'eau et payées sur le pool du challenge
 * (`services/challenge/ml-rewards.service.ts`, `evaluator/ml-reward.ts`).
 *
 * La définition déclare ce que le flow écrit dans le ledger et dans
 * `contributions`. Son code n'a pas encore rejoint ce dossier.
 */
export const mlFlow: FlowDefinition = {
  descriptor: mlFlowDescriptor,
  ruleKeys: [
    { key: "dataset", consumesPool: true },
    { key: "model_metric", consumesPool: true },
    { key: "model_code", consumesPool: true },
    { key: "beat_best", consumesPool: true },
    { key: "api_packaging", consumesPool: true },
    { key: "reuse_dataset", consumesPool: true },
    { key: "reuse_model", consumesPool: true },
  ],
  // `model_code` alimente la contribution `model` (voir `ML_ROLE_RULE`).
  contributionTypes: [
    { key: "dataset", countsAsContribution: true },
    { key: "model", countsAsContribution: true },
    { key: "api_packaging", countsAsContribution: true },
  ],
};
