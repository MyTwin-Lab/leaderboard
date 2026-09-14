import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken,
  mockCanEvaluate,
  mockClaim,
  mockScheduleRun,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockCanEvaluate: vi.fn(),
  mockClaim: vi.fn(),
  mockScheduleRun: vi.fn(),
}));

// Comme le vrai helper : `null` sans cookie access_token ; la doublure décide du reste
// (`null` = jeton refusé, dont `sb_anon` et les refresh tokens).
vi.mock('@/lib/auth', () => ({
  verifyRequestToken: (req: NextRequest) =>
    req.cookies.get('access_token') ? mockVerifyRequestToken(req) : Promise.resolve(null),
}));

vi.mock('../../../../../../../../packages/services/challenge/code-rewards.service', () => ({
  CodeRewardsService: class {
    canEvaluate = mockCanEvaluate;
    claim = mockClaim;
    scheduleRun = mockScheduleRun;
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
  mockVerifyRequestToken.mockResolvedValue({ userId: USER_ID, role: 'contributor' });
  mockCanEvaluate.mockResolvedValue({ ok: true });
  mockClaim.mockResolvedValue({ ok: true });
});

describe('POST /api/challenges/[id]/project-evaluation', () => {
  it('returns 401 without a session', async () => {
    const res = await postEvaluation();

    expect(res.status).toBe(401);
    expect(mockCanEvaluate).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockScheduleRun).not.toHaveBeenCalled();
  });

  it('returns 400 with reason when canEvaluate fails with tasks_not_done', async () => {
    mockCanEvaluate.mockResolvedValue({ ok: false, reason: 'tasks_not_done' });

    const res = await postEvaluation('valid-token');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.reason).toBe('tasks_not_done');
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockScheduleRun).not.toHaveBeenCalled();
  });

  it('returns 409 when canEvaluate fails with already_running', async () => {
    mockCanEvaluate.mockResolvedValue({ ok: false, reason: 'already_running' });

    const res = await postEvaluation('valid-token');
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.reason).toBe('already_running');
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockScheduleRun).not.toHaveBeenCalled();
  });

  it('returns 409 when the claim loses the race, without scheduling a run', async () => {
    // canEvaluate a lu un statut libre, mais un lancement concurrent a pris le run entre-temps.
    mockClaim.mockResolvedValue({ ok: false, reason: 'already_running' });

    const res = await postEvaluation('valid-token');

    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('already_running');
    expect(mockScheduleRun).not.toHaveBeenCalled();
  });

  it('schedules only one run for two launches in a row', async () => {
    mockClaim
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: 'already_running' });

    const first = await postEvaluation('valid-token');
    const second = await postEvaluation('valid-token');

    expect(first.status).toBe(202);
    expect(second.status).toBe(409);
    expect(mockScheduleRun).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when the claim finds no resolvable workspace', async () => {
    mockClaim.mockResolvedValue({ ok: false, reason: 'workspace_not_ready' });

    const res = await postEvaluation('valid-token');

    expect(res.status).toBe(400);
    expect(mockScheduleRun).not.toHaveBeenCalled();
  });

  it('returns 202 and schedules the run once claimed', async () => {
    const res = await postEvaluation('valid-token');
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toEqual({ scheduled: true });
    expect(mockClaim).toHaveBeenCalledWith({ challengeId: CHALLENGE_ID, userId: USER_ID });
    expect(mockScheduleRun).toHaveBeenCalledWith({ challengeId: CHALLENGE_ID, userId: USER_ID });
  });
});
