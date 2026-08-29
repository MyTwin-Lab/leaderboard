import { describe, expect, it } from 'vitest';
import { resolveSignInVariant } from './signin';

/**
 * /signin renders one of two messages depending on why the visitor landed
 * there. The reason arrives as a URL parameter, so it is attacker-controlled:
 * only known values may select a variant, and anything else has to degrade to
 * the first-time explanation rather than render an empty or half-built screen.
 */
describe('resolveSignInVariant', () => {
  it('explains the sign-in when no reason is given', () => {
    expect(resolveSignInVariant(null).key).toBe('default');
  });

  it('asks to sign in again when the account was updated', () => {
    expect(resolveSignInVariant('account-updated').key).toBe('account-updated');
  });

  it('falls back to the explanation on an unknown reason', () => {
    expect(resolveSignInVariant('something-else').key).toBe('default');
  });

  it('falls back to the explanation on an empty reason', () => {
    expect(resolveSignInVariant('').key).toBe('default');
  });

  it('does not treat a reason as valid on casing alone', () => {
    expect(resolveSignInVariant('Account-Updated').key).toBe('default');
  });

  it('gives every variant an eyebrow, a title and at least one line of body copy', () => {
    for (const reason of [null, 'account-updated']) {
      const variant = resolveSignInVariant(reason);
      expect(variant.eyebrow.length).toBeGreaterThan(0);
      expect(variant.title.length).toBeGreaterThan(0);
      expect(variant.lines.length).toBeGreaterThan(0);
      expect(variant.lines.every((line) => line.length > 0)).toBe(true);
    }
  });

  it('leads each variant with the sentence that states why, then supporting detail', () => {
    // The page renders lines[0] larger than the rest, so a variant whose first
    // line is an aside would read as the headline's subtitle instead.
    expect(resolveSignInVariant(null).lines[0]).toMatch(/contributions/);
    expect(resolveSignInVariant('account-updated').lines[0]).toMatch(/administrator/);
  });
});
