import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContributionFindById, mockFindByContribution, mockUserFindByIds } = vi.hoisted(() => ({
  mockContributionFindById: vi.fn(),
  mockFindByContribution: vi.fn(),
  mockUserFindByIds: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ContributionRepository: class {
    findById = mockContributionFindById;
  },
  RewardEntryRepository: class {
    findByContribution = mockFindByContribution;
  },
  UserRepository: class {
    findByIds = mockUserFindByIds;
  },
}));

import { GET } from './route';

const CONTRIBUTION_ID = 'contribution-1';

function getRewards() {
  const req = new NextRequest(`http://localhost/api/contributions/${CONTRIBUTION_ID}/rewards`);
  return GET(req, { params: Promise.resolve({ id: CONTRIBUTION_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockContributionFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, evaluation_status: 'completed' });
  mockFindByContribution.mockResolvedValue([]);
  mockUserFindByIds.mockResolvedValue([]);
});

describe('GET /api/contributions/[id]/rewards', () => {
  it('returns 404 when the contribution does not exist', async () => {
    mockContributionFindById.mockResolvedValue(null);

    const res = await getRewards();

    expect(res.status).toBe(404);
    expect(mockFindByContribution).not.toHaveBeenCalled();
  });

  it('returns the total, evaluation status and mapped entries, oldest first', async () => {
    const older = new Date('2024-01-01T00:00:00Z');
    const newer = new Date('2024-02-01T00:00:00Z');
    mockFindByContribution.mockResolvedValue([
      { rule_key: 'model_metric', points: 40, source_user_id: null, meta: null, created_at: newer },
      { rule_key: 'dataset', points: 10, source_user_id: null, meta: null, created_at: older },
    ]);

    const res = await getRewards();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.contributionId).toBe(CONTRIBUTION_ID);
    expect(body.total).toBe(50);
    expect(body.evaluationStatus).toBe('completed');
    expect(body.entries.map((e: any) => e.ruleKey)).toEqual(['dataset', 'model_metric']);
    expect(body.entries[0].label).toBe('Dataset quality');
    expect(body.entries[1].label).toBe('Model metric');
  });

  it('resolves the counterparty name for reuse rows', async () => {
    mockFindByContribution.mockResolvedValue([
      { rule_key: 'reuse_dataset', points: 5, source_user_id: 'u1', meta: null, created_at: new Date() },
    ]);
    mockUserFindByIds.mockResolvedValue([{ uuid: 'u1', full_name: 'Alice' }]);

    const res = await getRewards();
    const body = await res.json();

    expect(body.entries[0].counterparty).toBe('Alice');
    expect(mockUserFindByIds).toHaveBeenCalledWith(['u1']);
  });

  it('uses the manager-provided label for a slack_signal entry', async () => {
    mockFindByContribution.mockResolvedValue([
      { rule_key: 'slack_signal', points: 5, source_user_id: null, meta: { signal_label: 'Great teamwork' }, created_at: new Date() },
    ]);

    const res = await getRewards();
    const body = await res.json();

    expect(body.entries[0].label).toBe('Great teamwork');
  });

  it('falls back to the raw rule_key when there is no known label', async () => {
    mockFindByContribution.mockResolvedValue([
      { rule_key: 'mystery_rule', points: 5, source_user_id: null, meta: null, created_at: new Date() },
    ]);

    const res = await getRewards();
    const body = await res.json();

    expect(body.entries[0].label).toBe('mystery_rule');
  });

  it('returns null counterparty when there is no source_user_id', async () => {
    mockFindByContribution.mockResolvedValue([
      { rule_key: 'dataset', points: 5, source_user_id: null, meta: null, created_at: new Date() },
    ]);

    const res = await getRewards();
    const body = await res.json();

    expect(body.entries[0].counterparty).toBeNull();
  });

  it('defaults evaluationStatus to null when absent', async () => {
    mockContributionFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID });

    const res = await getRewards();
    const body = await res.json();

    expect(body.evaluationStatus).toBeNull();
  });

  it('returns 500 when a repository call throws', async () => {
    mockContributionFindById.mockRejectedValue(new Error('db down'));

    const res = await getRewards();

    expect(res.status).toBe(500);
  });
});
