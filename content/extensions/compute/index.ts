import { z } from "zod";
import type { ExtensionDefinition } from "../../../packages/registry/platform.js";
import { extensionConfigOf, type FlowConfigSource } from "../../../packages/capabilities/flow-config.js";

export const COMPUTE_EXTENSION_KEY = "compute";

/**
 * Configuration de l'extension, rangée sous `flow_config.extensions.compute`.
 * `enabled` ouvre les demandes de puissance de calcul sur ce challenge, en plus
 * de la connexion Scaleway globale ; il reste modifiable après la création.
 */
export const computeConfigSchema = z.object({
  enabled: z.boolean().default(false),
});

/** La puissance de calcul est ouverte sur ce challenge. */
export function computeEnabledFor(challenge: FlowConfigSource): boolean {
  return extensionConfigOf(challenge, COMPUTE_EXTENSION_KEY)?.enabled === true;
}

/**
 * Extension puissance de calcul — demandes d'instances GPU Scaleway, décidées
 * par le manager et expirées au bout de leur fenêtre
 * (`services/compute/compute-request.service.ts`).
 *
 * Réservée au flow ML. N'écrit rien dans le ledger.
 */
export const computeExtension: ExtensionDefinition = {
  key: COMPUTE_EXTENSION_KEY,
  appliesTo: ["ml"],
  config: { schema: computeConfigSchema, editableKeys: ["enabled"] },
};
