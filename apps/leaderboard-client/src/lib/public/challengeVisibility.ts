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
 * installed flow knows is private. Validation challenges are in: their public
 * page is the vitrine screen, like every other brief-gated type — read it,
 * join, and the walkthrough comes after. Placeholders (`none`) are in: a
 * catalogue entry that nobody can see is a catalogue entry that does not
 * exist. Their page is the vitrine screen, which needs neither metrics nor
 * task progress — see `showVitrineScreen`.
 */
const PUBLIC_STATUSES = new Set(['active', 'completed', 'archived']);

/** Ce qu'on ne propose pas aux moteurs, tout en le laissant lisible. */
const UNINDEXED_STATUSES = new Set(['archived']);

export function isPubliclyVisible(challenge: {
  status: string | null | undefined;
  type: string | null | undefined;
}): boolean {
  return (
    !!challenge.status && PUBLIC_STATUSES.has(challenge.status)
    && flowCatalog.get(challenge.type)?.publiclyVisible === true
  );
}

/**
 * Ce qu'on propose aux moteurs : le sitemap et les métadonnées indexables.
 *
 * Distinct de `isPubliclyVisible`, et c'est le fond du sujet : être lisible et
 * mériter d'être référencé sont deux choses. Un challenge archivé reste une
 * page publique — le listing lui donne sa pastille « Archived » et on doit
 * pouvoir relire ce qui a été fait — mais le pousser en résultat de recherche
 * mettrait en avant un travail retiré, au détriment des challenges ouverts.
 */
export function isIndexable(challenge: {
  status: string | null | undefined;
  type: string | null | undefined;
}): boolean {
  return isPubliclyVisible(challenge) && !UNINDEXED_STATUSES.has(challenge.status!);
}
