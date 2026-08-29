import { describe, expect, it } from 'vitest';
import { toPublicMlRewards } from './mlRewards';

// This route looks harmless and is not: it returns CP per person and the
// reward configuration itself. The page reads neither — mlRewardsQuery types
// its result as { metric, bestValue } (challenges/[id]/page.tsx:176-179).
const RAW = {
  pool: 1000,
  distributed: 420,
  remaining: 580,
  rules: { model: { metric: { name: 'auc', baseline: 0.5, blockThreshold: 0.95 } } },
  metric: { name: 'auc', baseline: 0.5, points: [0.91, 0.88] },
  bestValue: 0.91,
  thresholdReached: false,
  breakdown: [{ userId: 'u1', points: 260 }, { userId: 'u2', points: 160 }],
};

describe('toPublicMlRewards', () => {
  it('drops the per-user breakdown', () => {
    const result = toPublicMlRewards(RAW) as Record<string, unknown>;
    expect(result.breakdown).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('u1');
  });

  it('drops the reward rules configuration', () => {
    const result = toPublicMlRewards(RAW) as Record<string, unknown>;
    expect(result.rules).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('blockThreshold');
  });

  it('keeps exactly what the hero reads', () => {
    expect(toPublicMlRewards(RAW)).toEqual({
      metric: { name: 'auc', baseline: 0.5, points: [0.91, 0.88] },
      bestValue: 0.91,
    });
  });

  it('survives a challenge with no metric', () => {
    expect(toPublicMlRewards({ metric: null, bestValue: null } as any)).toEqual({
      metric: null,
      bestValue: null,
    });
  });
});
