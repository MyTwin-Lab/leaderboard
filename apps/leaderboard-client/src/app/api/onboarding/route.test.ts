import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockVerifyRequestToken, mockFetchOnboardingQuests, mockModuleNotFoundResponse } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockFetchOnboardingQuests: vi.fn(),
  mockModuleNotFoundResponse: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/server/onboarding', () => ({ fetchOnboardingQuests: mockFetchOnboardingQuests }));
vi.mock('@/lib/server/modules', () => ({ moduleNotFoundResponse: mockModuleNotFoundResponse }));

import * as route from './route';

const USER_ID = 'user-1';

function getOnboarding() {
  return route.GET(new NextRequest('http://localhost/api/onboarding'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: USER_ID, role: 'contributor', email: 'a@b.com' });
  mockModuleNotFoundResponse.mockResolvedValue(null);
});

describe('GET /api/onboarding', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await getOnboarding();

    expect(res.status).toBe(401);
    expect(mockFetchOnboardingQuests).not.toHaveBeenCalled();
  });

  it('returns 404 while the onboarding module is disabled', async () => {
    mockModuleNotFoundResponse.mockResolvedValue(NextResponse.json({ error: 'Not found' }, { status: 404 }));

    const res = await getOnboarding();

    expect(res.status).toBe(404);
    expect(mockModuleNotFoundResponse).toHaveBeenCalledWith('onboarding');
    expect(mockFetchOnboardingQuests).not.toHaveBeenCalled();
  });

  it('returns the installed quests and their state for the current user', async () => {
    const quests = [
      { key: 'clicked_challenge', label: 'Explore a challenge', description: null, completed: true },
      { key: 'assigned_task', label: 'Assign yourself to a task', description: null, completed: false },
    ];
    mockFetchOnboardingQuests.mockResolvedValue(quests);

    const res = await getOnboarding();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ quests });
    expect(mockFetchOnboardingQuests).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when the quests cannot be read', async () => {
    mockFetchOnboardingQuests.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await getOnboarding();

    expect(res.status).toBe(500);
  });
});

describe('/api/onboarding — no client-side validation', () => {
  it('no longer lets the browser mark a quest complete', () => {
    expect('PATCH' in route).toBe(false);
  });
});
