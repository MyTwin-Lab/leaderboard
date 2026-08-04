import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRunSyncEvaluation } = vi.hoisted(() => ({
  mockRunSyncEvaluation: vi.fn(),
}));

vi.mock('../../../../../../../../packages/services/challenge/challenge.service', () => ({
  ChallengeService: class {
    runSyncEvaluation = mockRunSyncEvaluation;
  },
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';

function postSync() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/sync`, { method: 'POST' });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/challenges/[id]/sync', () => {
  it('runs the sync evaluation and returns its count and evaluations', async () => {
    const evaluations = [{ uuid: 'e1' }, { uuid: 'e2' }];
    mockRunSyncEvaluation.mockResolvedValue(evaluations);

    const res = await postSync();

    expect(res.status).toBe(200);
    expect(mockRunSyncEvaluation).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(await res.json()).toEqual({ success: true, count: 2, evaluations });
  });

  it('returns an empty evaluations list when there is nothing to sync', async () => {
    mockRunSyncEvaluation.mockResolvedValue([]);

    const res = await postSync();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, count: 0, evaluations: [] });
  });

  it('returns 500 when the service throws', async () => {
    mockRunSyncEvaluation.mockRejectedValue(new Error('sync failed'));

    const res = await postSync();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to sync challenge' });
  });
});
