import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockChallengeFindById, mockFindByChallenge, mockBestMetricValue } = vi.hoisted(() => ({
  mockChallengeFindById: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockBestMetricValue: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  RewardEntryRepository: class {
    findByChallenge = mockFindByChallenge;
    bestMetricValue = mockBestMetricValue;
  },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';

function getRewards() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/ml-rewards`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBestMetricValue.mockResolvedValue(null);
});

describe('GET /api/challenges/[id]/ml-rewards', () => {
  it('returns 404 when the challenge does not exist', async () => {
    mockChallengeFindById.mockResolvedValue(null);

    const res = await getRewards();

    expect(res.status).toBe(404);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('returns 400 when the challenge is not an ML challenge', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code' });

    const res = await getRewards();

    expect(res.status).toBe(400);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('computes pool state and breakdown with no reward_rules (no metric)', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID,
      type: 'ml',
      contribution_points_reward: 1000,
      reward_rules: null,
    });
    mockFindByChallenge.mockResolvedValue([
      { user_id: 'u1', points: 100, rule_key: 'model_metric', meta: { metricValue: 0.9 } },
      { user_id: 'u2', points: 50, rule_key: 'dataset', meta: null },
      { user_id: 'u1', points: 20, rule_key: 'dataset', meta: null },
    ]);

    const res = await getRewards();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pool).toBe(1000);
    expect(body.distributed).toBe(170);
    expect(body.remaining).toBe(830);
    expect(body.rules).toBeNull();
    expect(body.metric).toBeNull();
    expect(body.breakdown).toEqual([
      { userId: 'u1', points: 120 },
      { userId: 'u2', points: 50 },
    ]);
  });

  it('computes the beat-the-leader metric timeline from model_metric entries', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID,
      type: 'ml',
      contribution_points_reward: 1000,
      reward_rules: { model: { metric: { name: 'accuracy', baseline: 0.5 } } },
    });
    mockFindByChallenge.mockResolvedValue([
      { user_id: 'u1', points: 10, rule_key: 'model_metric', meta: { metricValue: 0.7 } },
      { user_id: 'u1', points: 10, rule_key: 'model_metric', meta: { metricValue: 0.9 } },
      { user_id: 'u2', points: 10, rule_key: 'model_metric', meta: { metricValue: 0.8 } },
      { user_id: 'u3', points: 10, rule_key: 'dataset', meta: { metricValue: 0.99 } },
    ]);

    const res = await getRewards();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.metric).toEqual({
      name: 'accuracy',
      baseline: 0.5,
      points: [0.9, 0.8],
    });
  });

  it('remaining never goes negative when distributed exceeds the pool', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID,
      type: 'ml',
      contribution_points_reward: 10,
      reward_rules: null,
    });
    mockFindByChallenge.mockResolvedValue([
      { user_id: 'u1', points: 100, rule_key: 'dataset', meta: null },
    ]);

    const res = await getRewards();
    const body = await res.json();

    expect(body.remaining).toBe(0);
  });

  it('flags thresholdReached once the best metric meets the configured block threshold', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID,
      type: 'ml',
      contribution_points_reward: 1000,
      reward_rules: { model: { metric: { name: 'auc', baseline: 0.5, blockThreshold: 0.9 } } },
    });
    mockFindByChallenge.mockResolvedValue([]);
    mockBestMetricValue.mockResolvedValue(0.9);

    const res = await getRewards();
    const body = await res.json();

    expect(body.bestValue).toBe(0.9);
    expect(body.thresholdReached).toBe(true);
  });

  it('does not flag thresholdReached below the configured block threshold', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID,
      type: 'ml',
      contribution_points_reward: 1000,
      reward_rules: { model: { metric: { name: 'auc', baseline: 0.5, blockThreshold: 0.9 } } },
    });
    mockFindByChallenge.mockResolvedValue([]);
    mockBestMetricValue.mockResolvedValue(0.85);

    const res = await getRewards();
    const body = await res.json();

    expect(body.bestValue).toBe(0.85);
    expect(body.thresholdReached).toBe(false);
  });

  it('never flags thresholdReached when no threshold is configured', async () => {
    mockChallengeFindById.mockResolvedValue({
      uuid: CHALLENGE_ID,
      type: 'ml',
      contribution_points_reward: 1000,
      reward_rules: { model: { metric: { name: 'auc', baseline: 0.5 } } },
    });
    mockFindByChallenge.mockResolvedValue([]);
    mockBestMetricValue.mockResolvedValue(0.99);

    const res = await getRewards();
    const body = await res.json();

    expect(body.thresholdReached).toBe(false);
  });

  it('returns 500 when the repository throws', async () => {
    mockChallengeFindById.mockRejectedValue(new Error('db down'));

    const res = await getRewards();

    expect(res.status).toBe(500);
  });
});
