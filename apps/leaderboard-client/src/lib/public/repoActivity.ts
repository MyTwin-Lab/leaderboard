/**
 * Reduces repo activity to what an anonymous visitor may see.
 *
 * Two things must not go out. `metadata.branchName` names the
 * `contrib/<index>-<username>` branch the provisioner creates per contributor,
 * and a `branch_created` event exists only to announce such a branch — the
 * field and the event type both go. Connector failures are reported as a fixed
 * string, because a connector's own error text can name internal hosts or
 * carry a token.
 *
 * Kaggle activity describes public Kaggle artifacts and passes through.
 */
const PUBLIC_EVENT_TYPES = new Set(['commit', 'pull_request', 'pr_review']);

function toPublicEvent(event: any) {
  return {
    type: event.type,
    id: event.id,
    title: event.title,
    author: event.author,
    date: event.date,
    url: event.url,
    metadata: {
      ...(event.metadata?.sha !== undefined && { sha: event.metadata.sha }),
      ...(event.metadata?.additions !== undefined && { additions: event.metadata.additions }),
      ...(event.metadata?.deletions !== undefined && { deletions: event.metadata.deletions }),
      ...(event.metadata?.prNumber !== undefined && { prNumber: event.metadata.prNumber }),
      ...(event.metadata?.state !== undefined && { state: event.metadata.state }),
      ...(event.metadata?.reviewState !== undefined && { reviewState: event.metadata.reviewState }),
    },
  };
}

export function toPublicRepoActivity(activities: Record<string, any> | null | undefined): Record<string, any> {
  const out: Record<string, any> = {};

  for (const [repoId, activity] of Object.entries(activities ?? {})) {
    if (!activity || typeof activity !== 'object') continue;

    if ('error' in activity) {
      out[repoId] = { error: 'unavailable' };
      continue;
    }

    if (activity.type === 'github') {
      out[repoId] = {
        type: 'github',
        events: (activity.events ?? [])
          .filter((e: any) => PUBLIC_EVENT_TYPES.has(e?.type))
          .map(toPublicEvent),
      };
      continue;
    }

    out[repoId] = activity;
  }

  return out;
}
