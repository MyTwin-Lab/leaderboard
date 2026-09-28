import { isConnectorActivity } from '../../../../../packages/connectors/activity';

/**
 * Reduces repo activity to what an anonymous visitor may see.
 *
 * What a payload may not publish belongs to its connector (a GitHub
 * contributor branch name, for instance): each connector declares its own
 * `activity.toPublic`, looked up by `filterFor`. A payload whose connector
 * declares no filter describes public artifacts and passes through.
 *
 * Connector failures are reported as a fixed string, because a connector's
 * own error text can name internal hosts or carry a token.
 */
export type PublicActivityFilter = (connectorKey: string) => ((payload: unknown) => unknown) | undefined;

export function toPublicRepoActivity(
  activities: Record<string, unknown> | null | undefined,
  filterFor: PublicActivityFilter,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [repoId, activity] of Object.entries(activities ?? {})) {
    if (!activity || typeof activity !== 'object') continue;

    if ('error' in activity) {
      out[repoId] = { error: 'unavailable' };
      continue;
    }

    if (isConnectorActivity(activity)) {
      const toPublic = filterFor(activity.connectorKey);
      out[repoId] = toPublic ? { connectorKey: activity.connectorKey, payload: toPublic(activity.payload) } : activity;
    }
  }

  return out;
}
