import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockSaveStepFeedback } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockSaveStepFeedback: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('../../../../../../../../../../../packages/services/challenge/scenario-walkthrough.service', () => ({
  ScenarioWalkthroughService: class { saveStepFeedback = mockSaveStepFeedback; },
}));

import { PUT } from './route';
import {
  MedicalCommentForbiddenError,
  RunAlreadyCompletedError,
  ForbiddenRunAccessError,
} from '../../../../../../../../../../../packages/services/challenge/scenario-errors';

const CHALLENGE_ID = 'vch-1';
const RUN_ID = 'run-1';
const STEP_ID = 'step-1';
const routeParams = { params: Promise.resolve({ id: CHALLENGE_ID, runId: RUN_ID, stepId: STEP_ID }) };

function putStep(body: unknown) {
  const req = new NextRequest(
    `http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-runs/${RUN_ID}/steps/${STEP_ID}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  return PUT(req, routeParams);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });
  mockSaveStepFeedback.mockResolvedValue({
    runId: RUN_ID, contributionId: 'app-1', completedAt: null, globalFeedback: null,
    steps: [{ stepId: STEP_ID, position: 0, title: 'Create an account', instructions: null, result: 'passed', comment: null, medicalComment: null }],
  });
});

describe('PUT .../validation-scenario-runs/[runId]/steps/[stepId]', () => {
  it('saves a result and returns the whole walkthrough state', async () => {
    const res = await putStep({ result: 'passed' });

    expect(res.status).toBe(200);
    expect(mockSaveStepFeedback).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, runId: RUN_ID, stepId: STEP_ID, validatorUserId: 'bob',
      result: 'passed', comment: null, medicalComment: null,
    });
  });

  it('carries both the comment and the medical comment', async () => {
    await putStep({
      result: 'failed',
      comment: 'The PDF opens blank.',
      medical_comment: 'A measurement without its unit is not a clinical record.',
    });

    expect(mockSaveStepFeedback).toHaveBeenCalledWith(expect.objectContaining({
      comment: 'The PDF opens blank.',
      medicalComment: 'A measurement without its unit is not a clinical record.',
    }));
  });

  it('rejects a result outside passed/failed/blocked', async () => {
    expect((await putStep({ result: 'maybe' })).status).toBe(400);
  });

  it('returns 403 when a validator without the expert qualification sends a medical comment', async () => {
    mockSaveStepFeedback.mockRejectedValue(new MedicalCommentForbiddenError('no'));

    expect((await putStep({ result: 'passed', medical_comment: 'Unsafe.' })).status).toBe(403);
  });

  it('returns 409 on a completed walkthrough', async () => {
    mockSaveStepFeedback.mockRejectedValue(new RunAlreadyCompletedError('done'));

    expect((await putStep({ result: 'passed' })).status).toBe(409);
  });

  it('returns 403 on someone else\'s walkthrough', async () => {
    mockSaveStepFeedback.mockRejectedValue(new ForbiddenRunAccessError('not yours'));

    expect((await putStep({ result: 'passed' })).status).toBe(403);
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await putStep({ result: 'passed' })).status).toBe(401);
  });
});
