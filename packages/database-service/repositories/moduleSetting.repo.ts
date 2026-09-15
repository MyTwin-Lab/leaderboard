import { db, module_settings } from "../db/drizzle";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export interface ModuleSetting {
  key: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  updated_at: Date;
  updated_by: string | null;
}

function toDomain(row: InferSelectModel<typeof module_settings>): ModuleSetting {
  return {
    key: row.key,
    enabled: row.enabled,
    settings: (row.settings as Record<string, unknown> | null) ?? {},
    updated_at: row.updated_at,
    updated_by: row.updated_by ?? null,
  };
}

/**
 * ModuleSettingRepository
 * -----------------------
 * Une ligne par module installé dont l'admin a changé l'état ou les réglages.
 * La validation des réglages appartient à la capacité `modules`.
 */
export class ModuleSettingRepository {
  async find(key: string): Promise<ModuleSetting | null> {
    const [row] = await db.select().from(module_settings).where(eq(module_settings.key, key));
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<ModuleSetting[]> {
    const rows = await db.select().from(module_settings);
    return rows.map(toDomain);
  }

  /** Écrit l'état et les réglages complets du module, et qui les a changés. */
  async save(
    key: string,
    state: { enabled: boolean; settings: Record<string, unknown> },
    updatedBy: string | null,
  ): Promise<ModuleSetting> {
    const set = { enabled: state.enabled, settings: state.settings, updated_at: new Date(), updated_by: updatedBy };
    const [row] = await db
      .insert(module_settings)
      .values({ key, ...set })
      .onConflictDoUpdate({ target: module_settings.key, set })
      .returning();
    return toDomain(row);
  }
}
