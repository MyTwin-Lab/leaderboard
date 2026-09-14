import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindWithChallenge, mockVerifyRequestToken, mockRunSyncEvaluation } = vi.hoisted(() => ({
  mockFindWithChallenge: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockRunSyncEvaluation: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  EvaluationRunsRepository: class {
    findWithChallenge = mockFindWithChallenge;
  },
}));

// Comme le vrai helper : `null` sans cookie access_token ; la doublure décide du reste
// (`null` = jeton refusé, dont `sb_anon` et les refresh tokens).
vi.mock('@/lib/auth', () => ({
  verifyRequestToken: (req: NextRequest) =>
    req.cookies.get('access_token') ? mockVerifyRequestToken(req) : Promise.resolve(null),
}));

vi.mock('../../../../../../../../packages/services/challenge/challenge.service', () => ({
  ChallengeService: class {
    runSyncEvaluation = mockRunSyncEvaluation;
  },
}));

import { POST } from './route';

const RUN_ID = 'run-1';

function postRetry(withCookie = true) {
  const req = new NextRequest(`http://localhost/api/evaluation-runs/${RUN_ID}/retry`, {
    method: 'POST',
    headers: withCookie ? { cookie: 'access_token=valid-token' } : undefined,
  });
  return POST(req, { params: Promise.resolve({ id: RUN_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
});

describe('POST /api/evaluation-runs/[id]/retry', () => {
  it('returns 401 when there is no access_token cookie', async () => {
    const res = await postRetry(false);
    expect(res.status).toBe(401);
    expect(mockVerifyRequestToken).not.toHaveBeenCalled();
    expect(mockFindWithChallenge).not.toHaveBeenCalled();
  });

  it('returns 401 when the token fails verification', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await postRetry();
    expect(res.status).toBe(401);
    expect(mockFindWithChallenge).not.toHaveBeenCalled();
  });

  it('returns 403 when the session role is not admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor' });
    const res = await postRetry();
    expect(res.status).toBe(403);
    expect(mockFindWithChallenge).not.toHaveBeenCalled();
  });

  it('returns 404 when the run does not exist', async () => {
    mockFindWithChallenge.mockResolvedValue(null);
    const res = await postRetry();
    expect(res.status).toBe(404);
    expect(mockRunSyncEvaluation).not.toHaveBeenCalled();
  });

  it('re-runs the sync evaluation for the run\'s challenge and returns the count', async () => {
    mockFindWithChallenge.mockResolvedValue({ run: { uuid: RUN_ID, challenge_id: 'challenge-1' }, challenge: { uuid: 'challenge-1' } });
    mockRunSyncEvaluation.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);

    const res = await postRetry();

    expect(res.status).toBe(200);
    expect(mockRunSyncEvaluation).toHaveBeenCalledWith('challenge-1');
    const body = await res.json();
    expect(body).toEqual({ success: true, count: 2, challengeId: 'challenge-1' });
  });

  it('returns 500 when the repository throws unexpectedly', async () => {
    mockFindWithChallenge.mockRejectedValue(new Error('db down'));
    const res = await postRetry();
    expect(res.status).toBe(500);
  });
});
