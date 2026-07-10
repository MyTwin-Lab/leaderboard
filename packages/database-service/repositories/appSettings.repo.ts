import { db, app_settings } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainAppSettings } from "../db/mappers";
import type { AppSettings } from "../domain/entities";

export class AppSettingsRepository {
  async get(): Promise<AppSettings> {
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    if (row) return toDomainAppSettings(row);
    // Auto-initialize singleton if missing
    const [inserted] = await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default" })
      .returning();
    return toDomainAppSettings(inserted);
  }

  async setTheme(theme_key: string, updated_by?: string): Promise<AppSettings> {
    const [upserted] = await db
      .insert(app_settings)
      .values({ id: 1, theme_key, updated_by: updated_by ?? null, updated_at: new Date() })
      .onConflictDoUpdate({
        target: app_settings.id,
        set: { theme_key, updated_by: updated_by ?? null, updated_at: new Date() },
      })
      .returning();
    return toDomainAppSettings(upserted);
  }
}
