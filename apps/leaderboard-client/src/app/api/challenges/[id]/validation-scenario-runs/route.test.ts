import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockOpenWalkthrough } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockOpenWalkthrough: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('../../../../../../../../packages/services/challenge/scenario-walkthrough.service', () => ({
  ScenarioWalkthroughService: class { openWalkthrough = mockOpenWalkthrough; },
}));

import { POST } from './route';
import {
  SelfWalkthroughError,
  EmptyScenarioError,
  TargetNotExposedError,
} from '../../../../../../../../packages/services/challenge/scenario-errors';

const CHALLENGE_ID = 'vch-1';
const APP = '11111111-1111-4111-8111-111111111111';

function openRun(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-runs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });
  mockOpenWalkthrough.mockResolvedValue({
    runId: 'run-1', contributionId: APP, completedAt: null, globalFeedback: null,
    steps: [{ stepId: 'step-1', position: 0, title: 'Create an account', instructions: null, result: null, comment: null, medicalComment: null }],
  });
});

describe('POST /api/challenges/[id]/validation-scenario-runs', () => {
  it('opens a walkthrough for any signed-in contributor', async () => {
    // Aucun rôle requis : n'importe quel contributeur peut parcourir une
    // application. Seul l'avis médical est gardé sur medical_pro.
    const res = await openRun({ contribution_id: APP });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runId).toBe('run-1');
    expect(mockOpenWalkthrough).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, contributionId: APP, validatorUserId: 'bob',
    });
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await openRun({ contribution_id: APP })).status).toBe(401);
    expect(mockOpenWalkthrough).not.toHaveBeenCalled();
  });

  it('rejects a body with no contribution_id', async () => {
    expect((await openRun({})).status).toBe(400);
  });

  it('returns 403 on my own application', async () => {
    mockOpenWalkthrough.mockRejectedValue(new SelfWalkthroughError('own'));

    expect((await openRun({ contribution_id: APP })).status).toBe(403);
  });

  it('returns 400 when the application is not exposed here', async () => {
    mockOpenWalkthrough.mockRejectedValue(new TargetNotExposedError('nope'));

    expect((await openRun({ contribution_id: APP })).status).toBe(400);
  });

  it('returns 400 when no scenario step has been written yet', async () => {
    mockOpenWalkthrough.mockRejectedValue(new EmptyScenarioError('empty'));

    expect((await openRun({ contribution_id: APP })).status).toBe(400);
  });
});
