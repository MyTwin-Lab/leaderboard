import { flowCatalog } from '@/distribution/mytwin.flows';

/**
 * Which challenges an anonymous visitor may reach.
 *
 * Both rules are allowlists rather than "everything except X". The status list
 * must stay in step with fetchProjectsWithChallenges()
 * (lib/server/publicPages.ts:97-101), which decides what the list shows.
 *
 * The challenge type is decided by its flow (`publiclyVisible`): a flow added
 * later is private until its descriptor says otherwise, and a type no
 * installed flow knows is private. Validation challenges are not public: the
 * public page shows either the dataset/model metrics or per-contributor task
 * progress, and a validation challenge has neither.
 */
const PUBLIC_STATUSES = new Set(['active', 'completed']);

export function isPubliclyVisible(challenge: {
  status: string | null | undefined;
  type: string | null | undefined;
}): boolean {
  return (
    !!challenge.status && PUBLIC_STATUSES.has(challenge.status)
    && flowCatalog.get(challenge.type)?.publiclyVisible === true
  );
}
