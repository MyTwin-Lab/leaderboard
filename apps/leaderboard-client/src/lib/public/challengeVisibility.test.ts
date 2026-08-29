import { describe, expect, it } from 'vitest';
import { isPubliclyVisible } from './challengeVisibility';

// The list page (fetchProjectsWithChallenges, lib/server/publicPages.ts:97-101)
// already hides draft and archived from non-admins. If this function ever
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

  it('hides an archived challenge', () => {
    expect(isPubliclyVisible({ status: 'archived', type: 'code' })).toBe(false);
  });

  it('hides a status it does not recognise', () => {
    // A status added later is private until someone decides otherwise.
    expect(isPubliclyVisible({ status: 'paused', type: 'code' })).toBe(false);
  });

  it('hides a missing status', () => {
    expect(isPubliclyVisible({ status: null, type: 'code' })).toBe(false);
    expect(isPubliclyVisible({ status: undefined, type: 'code' })).toBe(false);
  });

  // Validation challenges have no public view: neither the metrics block nor
  // the per-contributor progress applies to them, so there is nothing to show.
  it('hides a validation challenge whatever its status', () => {
    expect(isPubliclyVisible({ status: 'active', type: 'validation' })).toBe(false);
    expect(isPubliclyVisible({ status: 'completed', type: 'validation' })).toBe(false);
  });

  it('hides a type it does not recognise', () => {
    expect(isPubliclyVisible({ status: 'active', type: 'survey' })).toBe(false);
  });

  it('hides a missing type', () => {
    expect(isPubliclyVisible({ status: 'active', type: null })).toBe(false);
  });
});
