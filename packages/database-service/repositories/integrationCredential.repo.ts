import { db, integration_credentials } from "../db/drizzle";
import { eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { IntegrationCredential } from "../domain/entities";

type Row = InferSelectModel<typeof integration_credentials>;

function toDomain(row: Row): IntegrationCredential {
  return {
    key: row.key,
    secret_enc: row.secret_enc ?? null,
    secret_iv: row.secret_iv ?? null,
    meta: (row.meta as Record<string, unknown> | null) ?? {},
    connected_at: row.connected_at ?? null,
    connected_by: row.connected_by ?? null,
  };
}

export interface IntegrationCredentialInput {
  key: string;
  secret_enc: string | null;
  secret_iv: string | null;
  meta?: Record<string, unknown>;
  connected_by: string | null;
}

/**
 * IntegrationCredentialRepository
 * -------------------------------
 * Une ligne par intégration. Le chiffrement n'est pas fait ici : la capacité
 * `credentials` chiffre avant d'écrire et déchiffre après avoir lu.
 */
export class IntegrationCredentialRepository {
  async find(key: string): Promise<IntegrationCredential | null> {
    const [row] = await db.select().from(integration_credentials).where(eq(integration_credentials.key, key));
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<IntegrationCredential[]> {
    const rows = await db.select().from(integration_credentials);
    return rows.map(toDomain);
  }

  /** Connecte ou reconnecte : remplace le secret et le `meta`, et date la connexion. */
  async save(input: IntegrationCredentialInput): Promise<IntegrationCredential> {
    const set = {
      secret_enc: input.secret_enc,
      secret_iv: input.secret_iv,
      meta: input.meta ?? {},
      connected_at: new Date(),
      connected_by: input.connected_by,
    };
    const [row] = await db
      .insert(integration_credentials)
      .values({ key: input.key, ...set })
      .onConflictDoUpdate({ target: integration_credentials.key, set })
      .returning();
    return toDomain(row);
  }

  /** Fusionne des clés dans `meta`, sans toucher au secret. `null` est une valeur. */
  async patchMeta(key: string, patch: Record<string, unknown>): Promise<IntegrationCredential | null> {
    const [row] = await db
      .update(integration_credentials)
      .set({ meta: sql`COALESCE(${integration_credentials.meta}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb` })
      .where(eq(integration_credentials.key, key))
      .returning();
    return row ? toDomain(row) : null;
  }

  async remove(key: string): Promise<boolean> {
    const rows = await db
      .delete(integration_credentials)
      .where(eq(integration_credentials.key, key))
      .returning({ key: integration_credentials.key });
    return rows.length > 0;
  }
}
