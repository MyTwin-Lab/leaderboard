import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockCompleteWalkthrough } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockCompleteWalkthrough: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('../../../../../../../../../../packages/services/challenge/scenario-walkthrough.service', () => ({
  ScenarioWalkthroughService: class { completeWalkthrough = mockCompleteWalkthrough; },
}));

import { POST } from './route';
import {
  IncompleteWalkthroughError,
  RunAlreadyCompletedError,
  SelfWalkthroughError,
} from '../../../../../../../../../../packages/services/challenge/scenario-errors';

const CHALLENGE_ID = 'vch-1';
const RUN_ID = 'run-1';
const routeParams = { params: Promise.resolve({ id: CHALLENGE_ID, runId: RUN_ID }) };

function completeRun(body: unknown) {
  const req = new NextRequest(
    `http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-runs/${RUN_ID}/complete`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  return POST(req, routeParams);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });
});

describe('POST .../validation-scenario-runs/[runId]/complete', () => {
  it('completes the walkthrough and reports the CP awarded', async () => {
    mockCompleteWalkthrough.mockResolvedValue({ completed: true, cpAwarded: 200 });

    const res = await completeRun({ global_feedback: 'Usable end to end.' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: true, cpAwarded: 200 });
    expect(mockCompleteWalkthrough).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, runId: RUN_ID, validatorUserId: 'bob',
      globalFeedback: 'Usable end to end.',
    });
  });

  it('rejects an empty overall feedback before it reaches the service', async () => {
    expect((await completeRun({ global_feedback: '   ' })).status).toBe(400);
    expect(mockCompleteWalkthrough).not.toHaveBeenCalled();
  });

  it('returns the unanswered step ids so the client can point at them', async () => {
    mockCompleteWalkthrough.mockRejectedValue(
      new IncompleteWalkthroughError('2 steps still have no result', ['step-3', 'step-5'])
    );

    const res = await completeRun({ global_feedback: 'Done.' });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.missingStepIds).toEqual(['step-3', 'step-5']);
    expect(body.error).toBe('2 steps still have no result');
  });

  it('returns 409 on an already-completed walkthrough', async () => {
    mockCompleteWalkthrough.mockRejectedValue(new RunAlreadyCompletedError('done'));

    expect((await completeRun({ global_feedback: 'Done.' })).status).toBe(409);
  });

  it('returns 403 when the application turns out to be my own group\'s', async () => {
    mockCompleteWalkthrough.mockRejectedValue(new SelfWalkthroughError('own'));

    expect((await completeRun({ global_feedback: 'Done.' })).status).toBe(403);
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await completeRun({ global_feedback: 'Done.' })).status).toBe(401);
  });
});
