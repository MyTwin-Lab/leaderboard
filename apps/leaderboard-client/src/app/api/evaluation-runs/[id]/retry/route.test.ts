import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindWithChallenge, mockVerifyRequestToken, mockRetryEvaluationRun } = vi.hoisted(() => ({
  mockFindWithChallenge: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockRetryEvaluationRun: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  EvaluationRunsRepository: class {
    findWithChallenge = mockFindWithChallenge;
  },
}));

vi.mock('../../../../../../../../packages/capabilities/evaluation', () => ({
  retryEvaluationRun: mockRetryEvaluationRun,
}));

// Comme le vrai helper : `null` sans cookie access_token ; la doublure décide du reste
// (`null` = jeton refusé, dont `sb_anon` et les refresh tokens).
vi.mock('@/lib/auth', () => ({
  verifyRequestToken: (req: NextRequest) =>
    req.cookies.get('access_token') ? mockVerifyRequestToken(req) : Promise.resolve(null),
}));

import { POST } from './route';

const RUN_ID = 'run-1';
const FAILED_RUN = {
  uuid: RUN_ID,
  challenge_id: 'challenge-1',
  status: 'failed',
  trigger_type: 'code',
  trigger_payload: { handler: 'project', payload: { challengeId: 'challenge-1', userId: 'u1' } },
};

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
  mockFindWithChallenge.mockResolvedValue({ run: FAILED_RUN, challenge: { uuid: 'challenge-1' } });
  mockRetryEvaluationRun.mockResolvedValue({ ok: true });
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
    expect(mockRetryEvaluationRun).not.toHaveBeenCalled();
  });

  it('replays the handler declared for the run and answers 202', async () => {
    const res = await postRetry();

    expect(res.status).toBe(202);
    expect(mockRetryEvaluationRun).toHaveBeenCalledWith(FAILED_RUN);
  });

  it('returns 409 with a readable reason when the run cannot be replayed', async () => {
    mockRetryEvaluationRun.mockResolvedValue({ ok: false, reason: 'not_failed' });

    const res = await postRetry();

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: 'Only a failed evaluation run can be retried', reason: 'not_failed' });
  });

  it('passes through a refusal of the handler it has no message for', async () => {
    mockRetryEvaluationRun.mockResolvedValue({ ok: false, reason: 'workspace_not_ready' });

    const res = await postRetry();

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/workspace_not_ready/);
  });

  it('returns 500 when the repository throws unexpectedly', async () => {
    mockFindWithChallenge.mockRejectedValue(new Error('db down'));
    const res = await postRetry();
    expect(res.status).toBe(500);
  });
});
