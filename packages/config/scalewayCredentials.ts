import { encryptToken } from './githubToken.js';

export { encryptToken };

export interface ScalewayCredentials {
  secretKey: string;
  projectId: string;
  zone: string;
}

/**
 * Internal use only (cron, deprovisioning an already-active instance) —
 * deliberately ignores `meta.disconnect_requested_at` so an instance approved
 * before a soft-disconnect can still be polled/cut via the Scaleway API.
 * User-facing gates must use isScalewayUserFacingConnected instead.
 */
export async function getScalewayCredentials(): Promise<ScalewayCredentials | null> {
  try {
    const { credentials } = await import('../capabilities/credentials.js');
    const stored = await credentials.get('scaleway');
    const { project_id: projectId, zone } = stored?.meta ?? {};
    if (stored?.secret && typeof projectId === 'string' && projectId && typeof zone === 'string' && zone) {
      return { secretKey: stored.secret, projectId, zone };
    }
  } catch {
    // DB unavailable or no credentials stored
  }
  return null;
}

/**
 * Respects `meta.disconnect_requested_at` — used by every gate that decides
 * whether a *new* request/approval/UI affordance should be allowed.
 */
export async function isScalewayUserFacingConnected(): Promise<boolean> {
  try {
    const { credentials } = await import('../capabilities/credentials.js');
    const status = await credentials.status('scaleway');
    return status.connected && !status.meta.disconnect_requested_at;
  } catch {
    return false;
  }
}
