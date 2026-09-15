import { db, app_settings } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainAppSettings } from "../db/mappers";
import type { AppSettings, SandboxStarTier } from "../domain/entities";

export interface AppSettingsUpdate {
  theme_key?: string;
  primary_color?: string | null;
  background_color?: string | null;
  theme_mode?: string;
  modules_meetings_enabled?: boolean;
  modules_onboarding_enabled?: boolean;
  digest_enabled?: boolean;
  digest_frequency_days?: number;
  sandbox_star_tiers?: SandboxStarTier[];
  sandbox_promotion_bonus_cp?: number;
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
    if (patch.theme_key !== undefined) set.theme_key = patch.theme_key;
    if (patch.primary_color !== undefined) set.primary_color = patch.primary_color;
    if (patch.background_color !== undefined) set.background_color = patch.background_color;
    if (patch.theme_mode !== undefined) set.theme_mode = patch.theme_mode;
    if (patch.modules_meetings_enabled !== undefined) set.modules_meetings_enabled = patch.modules_meetings_enabled;
    if (patch.modules_onboarding_enabled !== undefined) set.modules_onboarding_enabled = patch.modules_onboarding_enabled;
    // Un champ oublié dans cette liste passe la validation puis ne s'écrit
    // jamais — c'est exactement le bug qu'a connu `completion` sur les
    // challenges. Toute nouvelle colonne de AppSettingsUpdate se copie ici.
    if (patch.digest_enabled !== undefined) set.digest_enabled = patch.digest_enabled;
    if (patch.digest_frequency_days !== undefined) set.digest_frequency_days = patch.digest_frequency_days;
    if (patch.sandbox_star_tiers !== undefined) set.sandbox_star_tiers = patch.sandbox_star_tiers;
    if (patch.sandbox_promotion_bonus_cp !== undefined) set.sandbox_promotion_bonus_cp = patch.sandbox_promotion_bonus_cp;

    const [upserted] = await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default", theme_mode: "light", ...set })
      .onConflictDoUpdate({ target: app_settings.id, set })
      .returning();
    return toDomainAppSettings(upserted);
  }

}
