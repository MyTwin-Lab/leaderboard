import { decryptToken, encryptToken } from './githubToken.js';

export { encryptToken };

export interface ScalewayCredentials {
  secretKey: string;
  projectId: string;
  zone: string;
}

/**
 * Internal use only (cron, deprovisioning an already-active instance) —
 * deliberately ignores scaleway_disconnect_requested_at so an instance
 * approved before a soft-disconnect can still be polled/cut via the
 * Scaleway API. User-facing gates must use isScalewayUserFacingConnected
 * instead.
 */
export async function getScalewayCredentials(): Promise<ScalewayCredentials | null> {
  try {
    const { db, app_settings } = await import('../database-service/db/drizzle.js');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    if (row?.scaleway_secret_key_enc && row?.scaleway_secret_key_iv && row?.scaleway_project_id && row?.scaleway_zone) {
      return {
        secretKey: decryptToken(row.scaleway_secret_key_enc, row.scaleway_secret_key_iv),
        projectId: row.scaleway_project_id,
        zone: row.scaleway_zone,
      };
    }
  } catch {
    // DB unavailable or no credentials stored
  }
  return null;
}

/**
 * Respects scaleway_disconnect_requested_at — used by every gate that
 * decides whether a *new* request/approval/UI affordance should be allowed.
 */
export async function isScalewayUserFacingConnected(): Promise<boolean> {
  try {
    const { db, app_settings } = await import('../database-service/db/drizzle.js');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    return !!row?.scaleway_secret_key_enc && !row?.scaleway_disconnect_requested_at;
  } catch {
    return false;
  }
}
