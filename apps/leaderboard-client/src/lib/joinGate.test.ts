import { describe, it, expect } from 'vitest';
import { showJoinInHeader, joinAction, canSelectMore, MAX_INVITEES } from './joinGate';

const OPEN = { isMember: false, challengeType: 'code', challengeStatus: 'active' };

describe('showJoinInHeader', () => {
  it('shows Join to a non-member on an open code challenge', () => {
    expect(showJoinInHeader(OPEN)).toBe(true);
  });

  it('shows Join on an ml challenge too', () => {
    expect(showJoinInHeader({ ...OPEN, challengeType: 'ml' })).toBe(true);
  });

  it('does not depend on the visitor being signed in', () => {
    // Volontaire : la page est publique. Le composant route un anonyme vers
    // /signin au lieu d'ouvrir la modale, ce qui ferme le chemin par lequel un
    // non-connecté pouvait lancer une requête de join.
    expect(showJoinInHeader(OPEN)).toBe(true);
  });

  it('hides Join once the visitor is a member', () => {
    expect(showJoinInHeader({ ...OPEN, isMember: true })).toBe(false);
  });

  it('hides Join on a validation challenge', () => {
    expect(showJoinInHeader({ ...OPEN, challengeType: 'validation' })).toBe(false);
  });

  it('hides Join on a completed or archived challenge', () => {
    expect(showJoinInHeader({ ...OPEN, challengeStatus: 'completed' })).toBe(false);
    expect(showJoinInHeader({ ...OPEN, challengeStatus: 'archived' })).toBe(false);
  });

  it('hides Join when the type is missing', () => {
    expect(showJoinInHeader({ ...OPEN, challengeType: null })).toBe(false);
    expect(showJoinInHeader({ ...OPEN, challengeType: undefined })).toBe(false);
  });

  it('still shows Join when the status is unknown — only closed states hide it', () => {
    expect(showJoinInHeader({ ...OPEN, challengeStatus: null })).toBe(true);
  });
});

describe('joinAction', () => {
  it('is a solo join while nobody is selected', () => {
    expect(joinAction(0)).toEqual({ mode: 'solo', label: 'Join' });
  });

  it('becomes a group join as soon as one person is selected', () => {
    expect(joinAction(1)).toEqual({ mode: 'group', label: 'Join as a group' });
    expect(joinAction(2)).toEqual({ mode: 'group', label: 'Join as a group' });
  });
});

describe('canSelectMore', () => {
  it('leaves room for the group size minus your own seat', () => {
    expect(MAX_INVITEES).toBe(2);
    expect(canSelectMore(0)).toBe(true);
    expect(canSelectMore(1)).toBe(true);
  });

  it('stops at the cap', () => {
    expect(canSelectMore(2)).toBe(false);
    expect(canSelectMore(3)).toBe(false);
  });
});
