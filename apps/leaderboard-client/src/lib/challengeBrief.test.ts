import { describe, it, expect } from 'vitest';
import { BRIEF_FILENAME, findBrief, shouldShowBrief } from './challengeBrief';

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
  const base = { isAnonymous: false, isMember: false, challengeType: 'code', brief: '## Context' };

  it('shows the brief to a signed-in contributor who has not joined', () => {
    expect(shouldShowBrief(base)).toBe(true);
  });

  it('shows it on ML challenges too', () => {
    expect(shouldShowBrief({ ...base, challengeType: 'ml' })).toBe(true);
  });

  it('never shows it to an anonymous visitor', () => {
    expect(shouldShowBrief({ ...base, isAnonymous: true })).toBe(false);
  });

  it('never shows it to a member — they have already joined', () => {
    expect(shouldShowBrief({ ...base, isMember: true })).toBe(false);
  });

  it('falls back to the normal page when no brief was written', () => {
    expect(shouldShowBrief({ ...base, brief: null })).toBe(false);
    expect(shouldShowBrief({ ...base, brief: '' })).toBe(false);
    expect(shouldShowBrief({ ...base, brief: '   \n  ' })).toBe(false);
  });

  it('leaves validation challenges untouched', () => {
    expect(shouldShowBrief({ ...base, challengeType: 'validation' })).toBe(false);
  });

  it('leaves an unknown or missing type untouched', () => {
    expect(shouldShowBrief({ ...base, challengeType: null })).toBe(false);
    expect(shouldShowBrief({ ...base, challengeType: 'something-else' })).toBe(false);
  });
});
