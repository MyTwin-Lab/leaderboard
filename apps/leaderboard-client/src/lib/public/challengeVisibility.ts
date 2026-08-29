/**
 * Which challenge statuses an anonymous visitor may reach.
 *
 * Deliberately an allowlist rather than `!== 'draft' && !== 'archived'`: a
 * status added to the product later is private until someone puts it here.
 * Must stay in step with fetchProjectsWithChallenges()
 * (lib/server/publicPages.ts:97-101), which decides what the list shows.
 */
const PUBLIC_STATUSES = new Set(['active', 'completed']);

export function isPubliclyVisible(status: string | null | undefined): boolean {
  return !!status && PUBLIC_STATUSES.has(status);
}
