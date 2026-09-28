import type { FlowDefinition } from "../../../packages/registry/platform.js";
import { noneFlowDescriptor } from "./descriptor.js";

export { noneFlowDescriptor } from "./descriptor.js";

/**
 * Flow `none` — un challenge repère n'ouvre aucun travail : ni contribution,
 * ni clé de ledger, ni hook. Rien ne le rejoint. Il n'existe que pour que le
 * catalogue puisse nommer un sujet, et que son type soit une réponse plutôt
 * qu'un `null`.
 */
export const noneFlow: FlowDefinition = {
  descriptor: noneFlowDescriptor,
};
