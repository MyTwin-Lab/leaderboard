import { describe, expect, it } from 'vitest';
import { isIndexable, isPubliclyVisible } from './challengeVisibility';

// The list page (fetchProjectsWithChallenges, lib/server/publicPages.ts:97-101)
// hides drafts from non-admins, and nothing else. If this function ever
// disagrees with it, a challenge is either listed but unreachable, or
// reachable but unlisted.
describe('isPubliclyVisible', () => {
  it('publishes an active code challenge', () => {
    expect(isPubliclyVisible({ status: 'active', type: 'code' })).toBe(true);
  });

  it('publishes a completed ML challenge', () => {
    expect(isPubliclyVisible({ status: 'completed', type: 'ml' })).toBe(true);
  });

  it('hides a draft', () => {
    expect(isPubliclyVisible({ status: 'draft', type: 'code' })).toBe(false);
  });

  // Archivé reste lisible : le listing lui donne sa pastille « Archived », et
  // une page 404 sous une carte affichée est le pire des deux mondes.
  it('publishes an archived challenge', () => {
    expect(isPubliclyVisible({ status: 'archived', type: 'code' })).toBe(true);
  });

  it('hides a status it does not recognise', () => {
    // A status added later is private until someone decides otherwise.
    expect(isPubliclyVisible({ status: 'paused', type: 'code' })).toBe(false);
  });

  it('hides a missing status', () => {
    expect(isPubliclyVisible({ status: null, type: 'code' })).toBe(false);
    expect(isPubliclyVisible({ status: undefined, type: 'code' })).toBe(false);
  });

  // Leur page publique est la vitrine, comme pour tout type passant par le
  // brief : on la lit, on rejoint, le parcours vient après.
  it('publishes a validation challenge', () => {
    expect(isPubliclyVisible({ status: 'active', type: 'validation' })).toBe(true);
    expect(isPubliclyVisible({ status: 'completed', type: 'validation' })).toBe(true);
  });

  it('hides a type it does not recognise', () => {
    expect(isPubliclyVisible({ status: 'active', type: 'survey' })).toBe(false);
  });

  it('hides a missing type', () => {
    expect(isPubliclyVisible({ status: 'active', type: null })).toBe(false);
  });

});

// Lisible et référençable sont deux choses : un challenge retiré se relit,
// mais le pousser en résultat de recherche le mettrait en avant au détriment
// des challenges ouverts.
describe('isIndexable', () => {
  it('indexes what an anonymous visitor may reach', () => {
    expect(isIndexable({ status: 'active', type: 'code' })).toBe(true);
    expect(isIndexable({ status: 'completed', type: 'ml' })).toBe(true);
  });

  it('does not index an archived challenge, though its page is public', () => {
    expect(isPubliclyVisible({ status: 'archived', type: 'code' })).toBe(true);
    expect(isIndexable({ status: 'archived', type: 'code' })).toBe(false);
  });

  it('never indexes what is not public', () => {
    expect(isIndexable({ status: 'draft', type: 'code' })).toBe(false);
    expect(isIndexable({ status: 'active', type: 'survey' })).toBe(false);
  });
});
