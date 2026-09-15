import type { ExtensionDefinition } from "../../../packages/registry/platform.js";

/**
 * Extension puissance de calcul — demandes d'instances GPU Scaleway, décidées
 * par le manager et expirées au bout de leur fenêtre
 * (`services/compute/compute-request.service.ts`).
 *
 * Réservée au flow ML. N'écrit rien dans le ledger.
 */
export const computeExtension: ExtensionDefinition = {
  key: "compute",
  appliesTo: ["ml"],
};
