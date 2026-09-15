import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetSessionUser,
  mockOpenWalkthrough,
  mockIsManagerOfChallenge,
  mockChallengeFindById,
  mockContributionFindById,
  mockUserFindByIds,
  mockStepFindByChallenge,
  mockRunFindByChallenge,
  mockFeedbackFindByRuns,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockOpenWalkthrough: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockContributionFindById: vi.fn(),
  mockUserFindByIds: vi.fn(),
  mockStepFindByChallenge: vi.fn(),
  mockRunFindByChallenge: vi.fn(),
  mockFeedbackFindByRuns: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('../../../../../../../../packages/services/challenge/scenario-walkthrough.service', () => ({
  ScenarioWalkthroughService: class { openWalkthrough = mockOpenWalkthrough; },
}));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));
vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockChallengeFindById; },
  ContributionRepository: class { findById = mockContributionFindById; },
  UserRepository: class { findByIds = mockUserFindByIds; },
  ScenarioStepRepository: class { findByChallenge = mockStepFindByChallenge; },
  ScenarioRunRepository: class { findByChallenge = mockRunFindByChallenge; },
  StepFeedbackRepository: class { findByRuns = mockFeedbackFindByRuns; },
}));

import { GET, POST } from './route';
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

function getRuns() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-runs`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
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

describe('GET /api/challenges/[id]/validation-scenario-runs', () => {
  const APP_B = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockIsManagerOfChallenge.mockResolvedValue(false);
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'journey-validation', source_challenge_id: 'code-ch-1' });
    mockStepFindByChallenge.mockResolvedValue([
      { uuid: 'step-1', position: 0, title: 'Create an account' },
      { uuid: 'step-2', position: 1, title: 'Log in' },
    ]);
    mockRunFindByChallenge.mockResolvedValue([
      { uuid: 'run-1', contribution_id: APP, validator_user_id: 'bob', completed_at: new Date('2026-09-08'), global_feedback: 'Usable end to end.' },
      { uuid: 'run-2', contribution_id: APP_B, validator_user_id: 'carol', completed_at: null, global_feedback: null },
    ]);
    mockFeedbackFindByRuns.mockResolvedValue([
      { uuid: 'fb-2', run_id: 'run-1', step_id: 'step-2', result: 'failed', comment: 'Login loops.', medical_comment: 'Not usable in consultation.' },
      { uuid: 'fb-1', run_id: 'run-1', step_id: 'step-1', result: 'passed', comment: null, medical_comment: null },
      { uuid: 'fb-3', run_id: 'run-2', step_id: 'step-1', result: 'blocked', comment: null, medical_comment: null },
    ]);
    mockContributionFindById.mockImplementation(async (id: string) => ({
      uuid: id, user_id: id === APP ? 'alice' : 'dan', live_endpoint_url: `https://${id}.example.com`,
    }));
    mockUserFindByIds.mockResolvedValue([
      { uuid: 'alice', full_name: 'Alice' }, { uuid: 'dan', full_name: 'Dan' },
      { uuid: 'bob', full_name: 'Bob', role: 'medical_pro' }, { uuid: 'carol', full_name: 'Carol', role: 'contributor' },
    ]);
  });

  it('returns every walkthrough with its step results, comments and medical opinions', async () => {
    const body = await (await getRuns()).json();

    expect(body.runs).toHaveLength(2);
    expect(body.runs[0]).toMatchObject({
      id: 'run-1', validatorName: 'Bob', isMedicalPro: true,
      submitterName: 'Alice', globalFeedback: 'Usable end to end.', answeredCount: 2,
    });
  });

  it('orders step feedbacks by scenario position, not by insertion order', async () => {
    // Le panneau rend une ligne de marques P/F/B : dans l'ordre d'insertion,
    // elle ne correspondrait pas aux étapes qu'elle prétend résumer.
    const body = await (await getRuns()).json();

    expect(body.runs[0].stepFeedbacks.map((f: any) => f.stepId)).toEqual(['step-1', 'step-2']);
  });

  it('ships the scenario so the panel can label the marks without a second request', async () => {
    const body = await (await getRuns()).json();

    expect(body.steps).toEqual([
      { id: 'step-1', position: 0, title: 'Create an account' },
      { id: 'step-2', position: 1, title: 'Log in' },
    ]);
  });

  it('reports a draft with a null completedAt and a partial answered count', async () => {
    const body = await (await getRuns()).json();

    expect(body.runs[1]).toMatchObject({ completedAt: null, answeredCount: 1 });
  });

  it('allows a manager of this challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'project_manager' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    expect((await getRuns()).status).toBe(200);
  });

  it('returns 403 for a plain contributor', async () => {
    // Contrairement à la liste des cibles, que tout contributeur doit lire,
    // cette vue expose le retour signé de tous les autres validateurs.
    mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });

    expect((await getRuns()).status).toBe(403);
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await getRuns()).status).toBe(401);
  });
});
