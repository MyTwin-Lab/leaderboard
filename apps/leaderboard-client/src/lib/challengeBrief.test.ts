import { describe, it, expect } from 'vitest';
import {
  BRIEF_FILENAME,
  findBrief,
  isPlaceholderChallenge,
  shouldShowBrief,
  showVitrineScreen,
} from './challengeBrief';

describe('findBrief', () => {
  it('picks the document named brief.md', () => {
    const docs = [
      { filename: 'notes.md', content: 'a' },
      { filename: BRIEF_FILENAME, content: 'b' },
    ];

    expect(findBrief(docs)).toEqual({ filename: BRIEF_FILENAME, content: 'b' });
  });

  it('returns null when the challenge has no brief', () => {
    expect(findBrief([{ filename: 'notes.md' }])).toBeNull();
    expect(findBrief([])).toBeNull();
  });
});

describe('shouldShowBrief', () => {
  const base = { isMember: false, challengeType: 'code', brief: '## Context' };

  it('shows the brief to a contributor who has not joined', () => {
    expect(shouldShowBrief(base)).toBe(true);
  });

  it('shows it on ML challenges too', () => {
    expect(shouldShowBrief({ ...base, challengeType: 'ml' })).toBe(true);
  });

  it('never shows it to a member — they have already joined', () => {
    expect(shouldShowBrief({ ...base, isMember: true })).toBe(false);
  });

  it('falls back to the normal page when no brief was written', () => {
    expect(shouldShowBrief({ ...base, brief: null })).toBe(false);
    expect(shouldShowBrief({ ...base, brief: '' })).toBe(false);
    expect(shouldShowBrief({ ...base, brief: '   \n  ' })).toBe(false);
  });

  it('gates a validation challenge like the others', () => {
    expect(shouldShowBrief({ ...base, challengeType: 'validation' })).toBe(true);
  });

  it('leaves an unknown or missing type untouched', () => {
    expect(shouldShowBrief({ ...base, challengeType: null })).toBe(false);
    expect(shouldShowBrief({ ...base, challengeType: 'something-else' })).toBe(false);
  });
});

describe('isPlaceholderChallenge', () => {
  it('only recognises the none type', () => {
    expect(isPlaceholderChallenge('none')).toBe(true);
    expect(isPlaceholderChallenge('code')).toBe(false);
    expect(isPlaceholderChallenge('ml')).toBe(false);
    expect(isPlaceholderChallenge('validation')).toBe(false);
  });

  it('does not treat a missing type as a placeholder', () => {
    // `null` est une row d'avant le type, que le reste du code rabat sur
    // `code` : la confondre avec un repère retirerait son board à un
    // challenge qui en a un.
    expect(isPlaceholderChallenge(null)).toBe(false);
    expect(isPlaceholderChallenge(undefined)).toBe(false);
    expect(isPlaceholderChallenge('')).toBe(false);
  });
});

describe('showVitrineScreen', () => {
  const base = { isMember: false, isPhone: false, challengeType: 'code', brief: '## Context' };

  it('is the only screen a placeholder has — brief or not, member or not', () => {
    const none = { ...base, challengeType: 'none' };
    expect(showVitrineScreen(none)).toBe(true);
    expect(showVitrineScreen({ ...none, brief: null })).toBe(true);
    expect(showVitrineScreen({ ...none, isMember: true })).toBe(true);
    expect(showVitrineScreen({ ...none, isMember: true, brief: null })).toBe(true);
  });

  it('shows it to a non-member of a code or ml challenge that has a brief', () => {
    expect(showVitrineScreen(base)).toBe(true);
    expect(showVitrineScreen({ ...base, challengeType: 'ml' })).toBe(true);
    expect(showVitrineScreen({ ...base, brief: null })).toBe(false);
  });

  it('keeps a member on it only on a phone', () => {
    expect(showVitrineScreen({ ...base, isMember: true })).toBe(false);
    expect(showVitrineScreen({ ...base, isMember: true, isPhone: true })).toBe(true);
    // Le renvoi vers un ordinateur vaut sans brief : c'est l'écran qui le porte.
    expect(showVitrineScreen({ ...base, isMember: true, isPhone: true, brief: null })).toBe(true);
  });

  // Un validateur lit la vitrine, rejoint, et le parcours vient après — la
  // même porte que pour un challenge code ou ml.
  it('shows the vitrine for a validation challenge nobody has joined', () => {
    expect(showVitrineScreen({ ...base, challengeType: 'validation' })).toBe(true);
    expect(showVitrineScreen({ ...base, challengeType: 'validation', isMember: true })).toBe(false);
  });

  it('leaves an unknown or missing type on the normal page', () => {
    expect(showVitrineScreen({ ...base, challengeType: null })).toBe(false);
    expect(showVitrineScreen({ ...base, challengeType: 'something-else' })).toBe(false);
  });
});
