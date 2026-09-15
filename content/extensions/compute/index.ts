import { z } from "zod";
import type { ActionAccess, ExtensionDefinition } from "../../../packages/registry/platform.js";
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

/** Trancher les demandes : un admin, ou le manager du challenge. */
const DECIDERS: ActionAccess = { roles: ["admin"], manager: true };

// Import à la demande : déclarer l'extension ne charge ni le service ni Scaleway.
const load = () => import("./actions.js");
const computeService = async () =>
  new (await import("../../../packages/services/compute/compute-request.service.js")).ComputeRequestService();

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
  hooks: {
    // Un challenge clos coupe ses instances encore actives, quel que soit le
    // temps restant sur leur fenêtre. Sans attendre : la clôture ne dépend pas
    // de Scaleway.
    async onClose(challenge) {
      (await computeService()).terminateForChallenge(challenge.uuid, "challenge_closed").catch((error) => {
        console.error("[compute] Terminating compute requests on close failed:", error);
      });
    },
    // Avant la suppression : `compute_requests` part en cascade avec le
    // challenge, et ses instances ne seraient plus joignables après.
    async onDelete(challenge) {
      await (await computeService()).terminateForChallenge(challenge.uuid, "challenge_deleted");
    },
  },
  // Le service vérifie qu'un contributeur peut demander (extension activée,
  // Scaleway connecté, pas de demande en cours).
  actions: [
    { path: "request", method: "GET", access: {}, handle: async (ctx) => (await load()).ownRequest(ctx) },
    { path: "request", method: "POST", access: {}, handle: async (ctx) => (await load()).requestCompute(ctx) },
    { path: "request/reveal-token", method: "POST", access: {}, handle: async (ctx) => (await load()).revealToken(ctx) },
    { path: "requests", method: "GET", access: DECIDERS, handle: async (ctx) => (await load()).listRequests(ctx) },
    { path: "requests/:requestId/decision", method: "POST", access: DECIDERS, handle: async (ctx) => (await load()).decide(ctx) },
  ],
};
