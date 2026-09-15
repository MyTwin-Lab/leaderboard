import type { IntegrationCredential } from "../database-service/domain/entities.js";
import type { IntegrationCredentialInput } from "../database-service/repositories/integrationCredential.repo.js";
import { decryptToken, encryptToken } from "./crypto.js";

/**
 * Capacité `credentials`
 * ----------------------
 * Le store des connexions aux services tiers : `credentials.get("github")`
 * rend le secret en clair et le `meta` de l'intégration. Le chiffrement ne
 * sort pas d'ici ; les appelants ne voient jamais `secret_enc`.
 */

export interface CredentialStore {
  find(key: string): Promise<IntegrationCredential | null>;
  save(input: IntegrationCredentialInput): Promise<IntegrationCredential>;
  patchMeta(key: string, patch: Record<string, unknown>): Promise<IntegrationCredential | null>;
  remove(key: string): Promise<boolean>;
}

export interface Credential {
  key: string;
  /** `null` : l'intégration est connue mais sans secret (en cours de déconnexion, par exemple). */
  secret: string | null;
  meta: Record<string, unknown>;
  connectedAt: Date | null;
  connectedBy: string | null;
}

export interface CredentialStatus {
  connected: boolean;
  meta: Record<string, unknown>;
  connectedAt: Date | null;
  connectedBy: string | null;
}

export interface Credentials {
  get(key: string): Promise<Credential | null>;
  /** Sans déchiffrer : ce qu'un écran de statut affiche. */
  status(key: string): Promise<CredentialStatus>;
  set(key: string, input: { secret: string; meta?: Record<string, unknown>; connectedBy: string | null }): Promise<void>;
  patchMeta(key: string, patch: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<boolean>;
}

export function createCredentials(store?: CredentialStore): Credentials {
  let resolved: CredentialStore | undefined = store;
  const repo = async (): Promise<CredentialStore> => {
    if (!resolved) {
      // Import à la demande : lire la capacité ne charge pas la base.
      const { IntegrationCredentialRepository } = await import("../database-service/repositories/integrationCredential.repo.js");
      resolved = new IntegrationCredentialRepository();
    }
    return resolved;
  };

  return {
    async get(key) {
      const row = await (await repo()).find(key);
      if (!row) return null;
      return {
        key: row.key,
        secret: row.secret_enc && row.secret_iv ? decryptToken(row.secret_enc, row.secret_iv) : null,
        meta: row.meta,
        connectedAt: row.connected_at,
        connectedBy: row.connected_by,
      };
    },

    async status(key) {
      const row = await (await repo()).find(key);
      return {
        connected: !!row?.secret_enc,
        meta: row?.meta ?? {},
        connectedAt: row?.connected_at ?? null,
        connectedBy: row?.connected_by ?? null,
      };
    },

    async set(key, { secret, meta, connectedBy }) {
      const { enc, iv } = encryptToken(secret);
      await (await repo()).save({ key, secret_enc: enc, secret_iv: iv, meta: meta ?? {}, connected_by: connectedBy });
    },

    async patchMeta(key, patch) {
      await (await repo()).patchMeta(key, patch);
    },

    async remove(key) {
      return (await repo()).remove(key);
    },
  };
}

/** Le store de la base. */
export const credentials: Credentials = createCredentials();
