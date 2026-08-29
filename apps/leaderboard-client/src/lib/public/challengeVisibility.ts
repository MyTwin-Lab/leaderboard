/**
 * Which challenges an anonymous visitor may reach.
 *
 * Both lists are allowlists rather than "everything except X": a status or a
 * challenge type added to the product later is private until someone puts it
 * here. The status list must stay in step with fetchProjectsWithChallenges()
 * (lib/server/publicPages.ts:97-101), which decides what the list shows.
 *
 * Validation challenges are excluded by type: the public page shows either the
 * dataset/model metrics or per-contributor task progress, and a validation
 * challenge has neither.
 */
const PUBLIC_STATUSES = new Set(['active', 'completed']);
const PUBLIC_TYPES = new Set(['code', 'ml']);

export function isPubliclyVisible(challenge: {
  status: string | null | undefined;
  type: string | null | undefined;
}): boolean {
  return (
    !!challenge.status && PUBLIC_STATUSES.has(challenge.status)
    && !!challenge.type && PUBLIC_TYPES.has(challenge.type)
  );
}
