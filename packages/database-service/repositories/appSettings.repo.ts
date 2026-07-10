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

  async updateGithubConnection(data: {
    github_token_enc: string;
    github_token_iv: string;
    github_org: string;
    github_connected_by: string;
  }): Promise<void> {
    const set = {
      github_token_enc: data.github_token_enc,
      github_token_iv: data.github_token_iv,
      github_org: data.github_org,
      github_connected_at: new Date(),
      github_connected_by: data.github_connected_by,
      updated_at: new Date(),
    };
    await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default", theme_mode: "dark", ...set })
      .onConflictDoUpdate({ target: app_settings.id, set });
  }

  async clearGithubConnection(): Promise<void> {
    await db
      .update(app_settings)
      .set({
        github_token_enc: null,
        github_token_iv: null,
        github_org: null,
        github_connected_at: null,
        github_connected_by: null,
        updated_at: new Date(),
      })
      .where(eq(app_settings.id, 1));
  }
}
