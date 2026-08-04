import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyRequestToken, mockFindByUserId, mockInitForUser, mockMarkStepComplete } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockFindByUserId: vi.fn(),
  mockInitForUser: vi.fn(),
  mockMarkStepComplete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  OnboardingProgressRepository: class {
    findByUserId = mockFindByUserId;
    initForUser = mockInitForUser;
    markStepComplete = mockMarkStepComplete;
  },
}));

import { GET, PATCH } from './route';

const USER_ID = 'user-1';

function getOnboarding() {
  const req = new NextRequest('http://localhost/api/onboarding');
  return GET(req);
}

function patchOnboarding(body: unknown) {
  const req = new NextRequest('http://localhost/api/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PATCH(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: USER_ID, role: 'contributor', email: 'a@b.com' });
});

describe('GET /api/onboarding', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await getOnboarding();

    expect(res.status).toBe(401);
    expect(mockFindByUserId).not.toHaveBeenCalled();
  });

  it('returns the existing progress for the current user', async () => {
    const progress = { user_id: USER_ID, clicked_challenge: true };
    mockFindByUserId.mockResolvedValue(progress);

    const res = await getOnboarding();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(progress);
    expect(mockInitForUser).not.toHaveBeenCalled();
  });

  it('auto-initializes progress when none exists yet', async () => {
    mockFindByUserId.mockResolvedValue(null);
    const created = { user_id: USER_ID, clicked_challenge: false };
    mockInitForUser.mockResolvedValue(created);

    const res = await getOnboarding();

    expect(res.status).toBe(200);
    expect(mockInitForUser).toHaveBeenCalledWith(USER_ID);
    expect(await res.json()).toEqual(created);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByUserId.mockRejectedValue(new Error('db down'));

    const res = await getOnboarding();

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/onboarding', () => {
  it('marks a step as complete', async () => {
    const updated = { user_id: USER_ID, clicked_challenge: true };
    mockMarkStepComplete.mockResolvedValue(updated);

    const res = await patchOnboarding({ step: 'clicked_challenge' });

    expect(res.status).toBe(200);
    expect(mockMarkStepComplete).toHaveBeenCalledWith(USER_ID, 'clicked_challenge');
    expect(await res.json()).toEqual(updated);
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await patchOnboarding({ step: 'clicked_challenge' });

    expect(res.status).toBe(401);
    expect(mockMarkStepComplete).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid step (Zod)', async () => {
    const res = await patchOnboarding({ step: 'not_a_real_step' });

    expect(res.status).toBe(400);
    expect(mockMarkStepComplete).not.toHaveBeenCalled();
  });

  it('returns 404 when the onboarding progress does not exist', async () => {
    mockMarkStepComplete.mockResolvedValue(null);

    const res = await patchOnboarding({ step: 'joined_meeting' });

    expect(res.status).toBe(404);
  });

  it('returns 500 when the repository throws', async () => {
    mockMarkStepComplete.mockRejectedValue(new Error('db down'));

    const res = await patchOnboarding({ step: 'joined_meeting' });

    expect(res.status).toBe(500);
  });
});
