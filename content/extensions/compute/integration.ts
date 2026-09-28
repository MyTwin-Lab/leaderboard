import type { IntegrationDefinition } from "../../../packages/connectors/integrations.js";
import { credentials as defaultCredentials, type Credentials } from "../../../packages/capabilities/credentials.js";

export const SCALEWAY_INTEGRATION_KEY = "scaleway";

/**
 * Connexion Scaleway de l'extension compute : une clé secrète, un projet et une
 * zone, vérifiés auprès de l'API. Le projet et la zone restent dans `meta`.
 *
 * La déconnexion est différée : elle pose `meta.disconnect_requested_at`, ce qui
 * ferme aussitôt les nouvelles demandes, mais garde le secret tant qu'une
 * instance déjà approuvée doit encore être coupée à la fin de sa fenêtre. Le
 * job d'expiration purge le secret dès qu'aucune demande n'est active
 * (`purgeScalewaySecretIfSafe`). Reconnecter annule la déconnexion demandée.
 */
export const scalewayIntegration: IntegrationDefinition = {
  key: SCALEWAY_INTEGRATION_KEY,
  label: "Scaleway",
  connectionLabel: "GPU compute connection",
  description:
    "Connect a Scaleway account so contributors on ML challenges can request temporary GPU compute power, approved by the challenge manager.",
  auth: {
    kind: "api_key",
    fields: [
      { name: "secret_key", label: "Secret key", secret: true, placeholder: "Secret key" },
      { name: "project_id", label: "Project ID", placeholder: "Project ID" },
      { name: "zone", label: "Zone", placeholder: "Zone (e.g. fr-par-2)", defaultValue: "fr-par-2" },
    ],
    async connect({ secret_key: secretKey, project_id: projectId, zone }) {
      try {
        // Import à la demande : déclarer l'intégration ne charge pas le client Scaleway.
        const { ScalewayClient } = await import("./scaleway/index.js");
        const ok = await new ScalewayClient(secretKey, projectId).testConnection(zone);
        if (!ok) return { ok: false, error: "Invalid Scaleway credentials or zone" };
      } catch {
        return { ok: false, error: "Could not reach Scaleway API", status: 502 };
      }
      return { ok: true, secret: secretKey, meta: { project_id: projectId, zone } };
    },
  },
  publicMeta: (meta) => (typeof meta.project_id === "string" ? [{ label: "Project", value: meta.project_id }] : []),
  isConnected: (status) => status.connected && !status.meta.disconnect_requested_at,
  async disconnect(credentials) {
    await credentials.patchMeta(SCALEWAY_INTEGRATION_KEY, { disconnect_requested_at: new Date().toISOString() });
  },
};

export interface ScalewayPurgeDeps {
  credentials: Pick<Credentials, "status" | "remove">;
  countActiveRequests(): Promise<number>;
}

/**
 * Supprime la connexion Scaleway si sa déconnexion a été demandée et
 * qu'aucune demande de calcul n'est encore active. Sans effet sinon : le job
 * d'expiration l'appelle à chaque passage.
 */
export async function purgeScalewaySecretIfSafe(deps?: Partial<ScalewayPurgeDeps>): Promise<boolean> {
  const store = deps?.credentials ?? defaultCredentials;
  const status = await store.status(SCALEWAY_INTEGRATION_KEY);
  if (!status.meta.disconnect_requested_at) return false;

  const countActive =
    deps?.countActiveRequests ??
    (async () => {
      const { ComputeRequestRepository } = await import("../../../packages/database-service/repositories/index.js");
      return new ComputeRequestRepository().countActiveGlobally();
    });
  if ((await countActive()) > 0) return false;

  return store.remove(SCALEWAY_INTEGRATION_KEY);
}
