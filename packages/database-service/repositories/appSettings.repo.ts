import { db, app_settings } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainAppSettings } from "../db/mappers";
import type { AppSettings } from "../domain/entities";

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
    // Auto-initialize singleton if missing
    const [inserted] = await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default", theme_mode: "dark" })
      .returning();
    return toDomainAppSettings(inserted);
  }

  async update(patch: AppSettingsUpdate, updated_by?: string): Promise<AppSettings> {
    const set: Record<string, unknown> = { updated_at: new Date(), updated_by: updated_by ?? null };
    if (patch.theme_key !== undefined) set.theme_key = patch.theme_key;
    if (patch.primary_color !== undefined) set.primary_color = patch.primary_color;
    if (patch.background_color !== undefined) set.background_color = patch.background_color;
    if (patch.theme_mode !== undefined) set.theme_mode = patch.theme_mode;

    const [upserted] = await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default", theme_mode: "dark", ...set })
      .onConflictDoUpdate({ target: app_settings.id, set })
      .returning();
    return toDomainAppSettings(upserted);
  }
}
