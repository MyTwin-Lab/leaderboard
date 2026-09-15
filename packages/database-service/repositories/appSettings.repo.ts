import { db, app_settings } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainAppSettings } from "../db/mappers";
import type { AppSettings } from "../domain/entities";

/**
 * Le thème de l'instance. L'état et les réglages des modules vivent dans
 * `module_settings` (capacité `modules`) ; leurs anciennes colonnes
 * d'`app_settings` ne sont plus lues et partent en L7.
 */
export interface AppSettingsUpdate {
  theme_key?: string;
  primary_color?: string | null;
  background_color?: string | null;
  theme_mode?: string;
}

export class AppSettingsRepository {
  async get(): Promise<AppSettings> {
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    if (row) return toDomainAppSettings(row);
    // Singleton absent (base vierge) : plusieurs lectures simultanées arrivent
    // ici ensemble. ON CONFLICT DO NOTHING laisse gagner la première sans lever
    // `duplicate key app_settings_pkey` chez les autres, qui relisent la ligne.
    await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default", theme_mode: "light" })
      .onConflictDoNothing({ target: app_settings.id });
    const [created] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    return toDomainAppSettings(created);
  }

  async update(patch: AppSettingsUpdate, updated_by?: string): Promise<AppSettings> {
    const set: Record<string, unknown> = { updated_at: new Date(), updated_by: updated_by ?? null };
    // Un champ oublié dans cette liste passe la validation puis ne s'écrit
    // jamais — c'est exactement le bug qu'a connu `completion` sur les
    // challenges. Toute nouvelle colonne de AppSettingsUpdate se copie ici.
    if (patch.theme_key !== undefined) set.theme_key = patch.theme_key;
    if (patch.primary_color !== undefined) set.primary_color = patch.primary_color;
    if (patch.background_color !== undefined) set.background_color = patch.background_color;
    if (patch.theme_mode !== undefined) set.theme_mode = patch.theme_mode;

    const [upserted] = await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default", theme_mode: "light", ...set })
      .onConflictDoUpdate({ target: app_settings.id, set })
      .returning();
    return toDomainAppSettings(upserted);
  }

}
