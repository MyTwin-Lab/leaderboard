import { describe, expect, it } from 'vitest';
import { completionPercent } from './taskProgress';

// Rendered next to "4/6", so the two must agree: a contributor showing 4/6
// beside 0% would read as a bug even if the bar were right.
describe('completionPercent', () => {
  it('rounds to the nearest whole percent', () => {
    expect(completionPercent(4, 6)).toBe(67);
    expect(completionPercent(2, 6)).toBe(33);
    expect(completionPercent(1, 6)).toBe(17);
  });

  it('reports nothing done as 0', () => {
    expect(completionPercent(0, 6)).toBe(0);
  });

  it('reports everything done as 100', () => {
    expect(completionPercent(6, 6)).toBe(100);
  });

  it('treats an empty board as 0 rather than dividing by zero', () => {
    expect(completionPercent(0, 0)).toBe(0);
  });

  it('never exceeds 100, even on inconsistent counts', () => {
    // done > total should not happen, but a stale cache or a race must not
    // paint a bar wider than its track.
    expect(completionPercent(8, 6)).toBe(100);
  });

  it('never goes below 0', () => {
    expect(completionPercent(-1, 6)).toBe(0);
  });
});
