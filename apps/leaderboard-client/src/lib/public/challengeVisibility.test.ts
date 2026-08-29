import { describe, expect, it } from 'vitest';
import { isPubliclyVisible } from './challengeVisibility';

// The list page (fetchProjectsWithChallenges, lib/server/publicPages.ts:97-101)
// already hides draft and archived from non-admins. If this function ever
// disagrees with it, a challenge is either listed but unreachable, or
// reachable but unlisted.
describe('isPubliclyVisible', () => {
  it('publishes an active challenge', () => {
    expect(isPubliclyVisible('active')).toBe(true);
  });

  it('publishes a completed challenge', () => {
    expect(isPubliclyVisible('completed')).toBe(true);
  });

  it('hides a draft', () => {
    expect(isPubliclyVisible('draft')).toBe(false);
  });

  it('hides an archived challenge', () => {
    expect(isPubliclyVisible('archived')).toBe(false);
  });

  it('hides a status it does not recognise', () => {
    // A status added later is private until someone decides otherwise.
    expect(isPubliclyVisible('paused')).toBe(false);
  });

  it('hides a missing status', () => {
    expect(isPubliclyVisible(null)).toBe(false);
    expect(isPubliclyVisible(undefined)).toBe(false);
  });
});
