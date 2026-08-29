import { db, app_settings } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainAppSettings } from "../db/mappers";
import type { AppSettings } from "../domain/entities";
import { ComputeRequestRepository } from "./computeRequest.repo";

export interface AppSettingsUpdate {
  theme_key?: string;
  primary_color?: string | null;
  background_color?: string | null;
  theme_mode?: string;
  modules_meetings_enabled?: boolean;
  modules_onboarding_enabled?: boolean;
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
    if (patch.modules_meetings_enabled !== undefined) set.modules_meetings_enabled = patch.modules_meetings_enabled;
    if (patch.modules_onboarding_enabled !== undefined) set.modules_onboarding_enabled = patch.modules_onboarding_enabled;

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

  async updateKaggleConnection(data: {
    kaggle_username: string;
    kaggle_key_enc: string;
    kaggle_key_iv: string;
    kaggle_connected_by: string;
  }): Promise<void> {
    const set = {
      kaggle_username: data.kaggle_username,
      kaggle_key_enc: data.kaggle_key_enc,
      kaggle_key_iv: data.kaggle_key_iv,
      kaggle_connected_at: new Date(),
      kaggle_connected_by: data.kaggle_connected_by,
      updated_at: new Date(),
    };
    await db
      .insert(app_settings)
      .values({ id: 1, theme_key: 'default', theme_mode: 'dark', ...set })
      .onConflictDoUpdate({ target: app_settings.id, set });
  }

  async updateOpenAIConnection(data: {
    openai_key_enc: string;
    openai_key_iv: string;
    openai_connected_by: string;
  }): Promise<void> {
    const set = {
      openai_key_enc: data.openai_key_enc,
      openai_key_iv: data.openai_key_iv,
      openai_connected_at: new Date(),
      openai_connected_by: data.openai_connected_by,
      updated_at: new Date(),
    };
    await db
      .insert(app_settings)
      .values({ id: 1, theme_key: 'default', theme_mode: 'dark', ...set })
      .onConflictDoUpdate({ target: app_settings.id, set });
  }

  async clearOpenAIConnection(): Promise<void> {
    await db
      .update(app_settings)
      .set({
        openai_key_enc: null,
        openai_key_iv: null,
        openai_connected_at: null,
        openai_connected_by: null,
        updated_at: new Date(),
      })
      .where(eq(app_settings.id, 1));
  }

  async updateSlackConnection(data: {
    slack_token_enc: string;
    slack_token_iv: string;
    slack_team_name: string;
    slack_connected_by: string;
  }): Promise<void> {
    const set = {
      slack_token_enc: data.slack_token_enc,
      slack_token_iv: data.slack_token_iv,
      slack_team_name: data.slack_team_name,
      slack_connected_at: new Date(),
      slack_connected_by: data.slack_connected_by,
      updated_at: new Date(),
    };
    await db
      .insert(app_settings)
      .values({ id: 1, theme_key: 'default', theme_mode: 'dark', ...set })
      .onConflictDoUpdate({ target: app_settings.id, set });
  }

  async clearSlackConnection(): Promise<void> {
    await db
      .update(app_settings)
      .set({
        slack_token_enc: null,
        slack_token_iv: null,
        slack_team_name: null,
        slack_connected_at: null,
        slack_connected_by: null,
        updated_at: new Date(),
      })
      .where(eq(app_settings.id, 1));
  }

  async clearKaggleConnection(): Promise<void> {
    await db
      .update(app_settings)
      .set({
        kaggle_username: null,
        kaggle_key_enc: null,
        kaggle_key_iv: null,
        kaggle_connected_at: null,
        kaggle_connected_by: null,
        updated_at: new Date(),
      })
      .where(eq(app_settings.id, 1));
  }

  async updateScalewayConnection(data: {
    scaleway_secret_key_enc: string;
    scaleway_secret_key_iv: string;
    scaleway_project_id: string;
    scaleway_zone: string;
    scaleway_connected_by: string;
  }): Promise<void> {
    const set = {
      scaleway_secret_key_enc: data.scaleway_secret_key_enc,
      scaleway_secret_key_iv: data.scaleway_secret_key_iv,
      scaleway_project_id: data.scaleway_project_id,
      scaleway_zone: data.scaleway_zone,
      scaleway_connected_at: new Date(),
      scaleway_connected_by: data.scaleway_connected_by,
      // A fresh connection cancels any pending soft-disconnect.
      scaleway_disconnect_requested_at: null,
      updated_at: new Date(),
    };
    await db
      .insert(app_settings)
      .values({ id: 1, theme_key: 'default', theme_mode: 'dark', ...set })
      .onConflictDoUpdate({ target: app_settings.id, set });
  }

  /**
   * Soft-disconnect: marks the connection as user-facing "disconnected"
   * (scaleway_is_connected flips to false everywhere) without erasing the
   * secret yet — an instance already approved before this call still needs
   * it to be cut via the Scaleway API when its 24h window elapses. The
   * secret is only actually purged once no request anywhere is still active
   * (see purgeScalewaySecretIfSafe, called by the expiration cron).
   */
  async requestScalewayDisconnect(): Promise<void> {
    await db
      .update(app_settings)
      .set({ scaleway_disconnect_requested_at: new Date(), updated_at: new Date() })
      .where(eq(app_settings.id, 1));
  }

  async purgeScalewaySecretIfSafe(): Promise<void> {
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    if (!row?.scaleway_disconnect_requested_at) return;
    const activeCount = await new ComputeRequestRepository().countActiveGlobally();
    if (activeCount > 0) return;
    await db
      .update(app_settings)
      .set({
        scaleway_secret_key_enc: null,
        scaleway_secret_key_iv: null,
        scaleway_project_id: null,
        scaleway_zone: null,
        scaleway_connected_at: null,
        scaleway_connected_by: null,
        scaleway_disconnect_requested_at: null,
        updated_at: new Date(),
      })
      .where(eq(app_settings.id, 1));
  }
}
