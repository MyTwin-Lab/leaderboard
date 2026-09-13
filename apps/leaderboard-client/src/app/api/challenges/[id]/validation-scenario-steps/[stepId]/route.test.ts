import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockEditStep, mockRemoveStep } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockEditStep: vi.fn(),
  mockRemoveStep: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));
vi.mock('../../../../../../../../../packages/services/challenge/scenario-steps.service', () => ({
  ScenarioStepsService: class {
    editStep = mockEditStep;
    removeStep = mockRemoveStep;
  },
}));

import { PATCH, DELETE } from './route';
import {
  ScenarioFrozenError,
  StepNotFoundError,
} from '../../../../../../../../../packages/services/challenge/scenario-errors';

const CHALLENGE_ID = 'vch-1';
const STEP_ID = 'step-1';
const routeParams = { params: Promise.resolve({ id: CHALLENGE_ID, stepId: STEP_ID }) };

function patchStep(body: unknown) {
  const req = new NextRequest(
    `http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-steps/${STEP_ID}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  return PATCH(req, routeParams);
}

function deleteStep() {
  const req = new NextRequest(
    `http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-steps/${STEP_ID}`,
    { method: 'DELETE' }
  );
  return DELETE(req, routeParams);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockEditStep.mockResolvedValue({ uuid: STEP_ID, position: 0, title: 'Sign up', instructions: null });
  mockRemoveStep.mockResolvedValue(undefined);
});

describe('PATCH .../validation-scenario-steps/[stepId]', () => {
  it('renames a step', async () => {
    const res = await patchStep({ title: 'Sign up' });

    expect(res.status).toBe(200);
    expect(mockEditStep).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, title: 'Sign up',
    });
  });

  it('reorders a step', async () => {
    await patchStep({ position: 2 });

    expect(mockEditStep).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, position: 2,
    });
  });

  it('clears the instructions when sent an explicit null', async () => {
    // `undefined` veut dire « n'y touche pas », `null` veut dire « vide-le ».
    // Sans ce distinguo on ne pourrait jamais retirer un détail déjà écrit.
    await patchStep({ instructions: null });

    expect(mockEditStep).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, instructions: null,
    });
  });

  it('rejects a body with nothing to change', async () => {
    expect((await patchStep({})).status).toBe(400);
  });

  it('rejects a negative position', async () => {
    expect((await patchStep({ position: -1 })).status).toBe(400);
  });

  it('returns 403 for a plain contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });

    expect((await patchStep({ title: 'Sign up' })).status).toBe(403);
  });

  it('returns 404 for a step on another challenge', async () => {
    mockEditStep.mockRejectedValue(new StepNotFoundError('nope'));

    expect((await patchStep({ title: 'Sign up' })).status).toBe(404);
  });

  it('returns 409 once a walkthrough exists', async () => {
    mockEditStep.mockRejectedValue(new ScenarioFrozenError('frozen'));

    expect((await patchStep({ title: 'Sign up' })).status).toBe(409);
  });
});

describe('DELETE .../validation-scenario-steps/[stepId]', () => {
  it('deletes a step', async () => {
    const res = await deleteStep();

    expect(res.status).toBe(200);
    expect(mockRemoveStep).toHaveBeenCalledWith({ validationChallengeId: CHALLENGE_ID, stepId: STEP_ID });
  });

  it('returns 409 once a walkthrough exists', async () => {
    mockRemoveStep.mockRejectedValue(new ScenarioFrozenError('frozen'));

    expect((await deleteStep()).status).toBe(409);
  });

  it('returns 403 for a plain contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });

    expect((await deleteStep()).status).toBe(403);
    expect(mockRemoveStep).not.toHaveBeenCalled();
  });
});
