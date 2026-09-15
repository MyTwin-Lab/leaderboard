import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { validationFlowDescriptor } from "./descriptor.js";

export { validationFlowDescriptor } from "./descriptor.js";

/**
 * Flow validation — cas de référence face à un endpoint (source ML) ou
 * parcours de scénario d'une application (source code), payés au forfait
 * `cp_per_validation` sur le pool du challenge.
 *
 * Un seul flow pour l'instant : la scission en deux flows et un kit partagé
 * vient avec la reprise des données (lot L3).
 */
export const validationFlow: FlowDefinition = {
  descriptor: validationFlowDescriptor,
  ruleKeys: [{ key: "validation", consumesPool: true }],
  contributionTypes: [{ key: "validation", countsAsContribution: true }],
};
