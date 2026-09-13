import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetSessionUser, mockIsManagerOfChallenge,
  mockListSteps, mockIsFrozen, mockAddStep,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockListSteps: vi.fn(),
  mockIsFrozen: vi.fn(),
  mockAddStep: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../packages/services/challenge/scenario-steps.service', () => ({
  ScenarioStepsService: class {
    listSteps = mockListSteps;
    isFrozen = mockIsFrozen;
    addStep = mockAddStep;
  },
}));

import { GET, POST } from './route';
import {
  ScenarioModeError,
  ScenarioFrozenError,
} from '../../../../../../../../packages/services/challenge/scenario-errors';

const CHALLENGE_ID = 'vch-1';

function getSteps() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-steps`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function postStep(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockListSteps.mockResolvedValue([
    { uuid: 'step-1', position: 0, title: 'Create an account', instructions: 'Sign up with an email address.' },
  ]);
  mockIsFrozen.mockResolvedValue(false);
});

describe('GET /api/challenges/[id]/validation-scenario-steps', () => {
  it('serves the scenario to any signed-in contributor', async () => {
    // Le scénario est le protocole, pas un secret : contrairement à la sortie
    // attendue d'un cas de référence, rien n'est caché au validateur.
    const res = await getSteps();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.steps).toEqual([
      { id: 'step-1', position: 0, title: 'Create an account', instructions: 'Sign up with an email address.' },
    ]);
  });

  it('reports the freeze so the editor can render read-only without trying a write first', async () => {
    mockIsFrozen.mockResolvedValue(true);

    const body = await (await getSteps()).json();

    expect(body.frozen).toBe(true);
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await getSteps()).status).toBe(401);
  });

  it('returns 400 on a reference-case validation challenge', async () => {
    mockListSteps.mockRejectedValue(new ScenarioModeError('nope'));

    expect((await getSteps()).status).toBe(400);
  });
});

describe('POST /api/challenges/[id]/validation-scenario-steps', () => {
  beforeEach(() => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockAddStep.mockResolvedValue({
      uuid: 'step-new', position: 1, title: 'Log in', instructions: null,
    });
  });

  it('adds a step for an admin', async () => {
    const res = await postStep({ title: 'Log in' });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ id: 'step-new', position: 1, title: 'Log in', instructions: null });
    expect(mockAddStep).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, title: 'Log in', instructions: null,
    });
  });

  it('adds a step for a manager of this challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'project_manager' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    expect((await postStep({ title: 'Log in' })).status).toBe(201);
  });

  it('returns 403 for a plain contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });

    expect((await postStep({ title: 'Log in' })).status).toBe(403);
    expect(mockAddStep).not.toHaveBeenCalled();
  });

  it('rejects an empty title', async () => {
    expect((await postStep({ title: '   ' })).status).toBe(400);
  });

  it('returns 409 once a walkthrough exists', async () => {
    mockAddStep.mockRejectedValue(new ScenarioFrozenError('frozen'));

    expect((await postStep({ title: 'Late step' })).status).toBe(409);
  });
});
