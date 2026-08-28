import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockJwtVerify,
  mockCanEvaluate,
  mockScheduleEvaluation,
} = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockCanEvaluate: vi.fn(),
  mockScheduleEvaluation: vi.fn(),
}));

vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

vi.mock('../../../../../../../../packages/services/challenge/code-rewards.service', () => ({
  CodeRewardsService: class {
    canEvaluate = mockCanEvaluate;
    scheduleEvaluation = mockScheduleEvaluation;
  },
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = 'user-1';

function postEvaluation(token?: string) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/project-evaluation`, {
    method: 'POST',
    headers: token ? { cookie: `access_token=${token}` } : undefined,
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: USER_ID, role: 'contributor' } });
  mockCanEvaluate.mockResolvedValue({ ok: true });
});

describe('POST /api/challenges/[id]/project-evaluation', () => {
  it('returns 401 without a session', async () => {
    const res = await postEvaluation();

    expect(res.status).toBe(401);
    expect(mockCanEvaluate).not.toHaveBeenCalled();
    expect(mockScheduleEvaluation).not.toHaveBeenCalled();
  });

  it('returns 400 with reason when canEvaluate fails with tasks_not_done', async () => {
    mockCanEvaluate.mockResolvedValue({ ok: false, reason: 'tasks_not_done' });

    const res = await postEvaluation('valid-token');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.reason).toBe('tasks_not_done');
    expect(mockScheduleEvaluation).not.toHaveBeenCalled();
  });

  it('returns 409 when canEvaluate fails with already_running', async () => {
    mockCanEvaluate.mockResolvedValue({ ok: false, reason: 'already_running' });

    const res = await postEvaluation('valid-token');
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.reason).toBe('already_running');
    expect(mockScheduleEvaluation).not.toHaveBeenCalled();
  });

  it('returns 202 and schedules evaluation when canEvaluate ok', async () => {
    const res = await postEvaluation('valid-token');
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toEqual({ scheduled: true });
    expect(mockScheduleEvaluation).toHaveBeenCalledWith({ challengeId: CHALLENGE_ID, userId: USER_ID });
  });
});
