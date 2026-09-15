import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { mlFlowDescriptor } from "./descriptor.js";

export { mlFlowDescriptor } from "./descriptor.js";

/** La clé qui porte la métrique d'un modèle, et le champ de `meta` où elle vit. */
export const MODEL_METRIC_RULE_KEY = "model_metric";
export const MODEL_METRIC_META_FIELD = "metricValue";

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
};
