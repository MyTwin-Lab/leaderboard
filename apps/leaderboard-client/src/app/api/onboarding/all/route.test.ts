import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindAllWithUsers, mockFetchContributorSession } = vi.hoisted(() => ({
  mockFindAllWithUsers: vi.fn(),
  mockFetchContributorSession: vi.fn(),
}));

vi.mock('@packages/database-service/repositories', () => ({
  OnboardingProgressRepository: class {
    findAllWithUsers = mockFindAllWithUsers;
  },
}));

vi.mock('@/lib/contributor', () => ({
  fetchContributorSession: mockFetchContributorSession,
}));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/onboarding/all', () => {
  it('returns 403 when there is no session', async () => {
    mockFetchContributorSession.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
    expect(mockFindAllWithUsers).not.toHaveBeenCalled();
  });

  it('returns 403 when the session is not an admin', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'contributor' });

    const res = await GET();

    expect(res.status).toBe(403);
    expect(mockFindAllWithUsers).not.toHaveBeenCalled();
  });

  it('returns the onboarding progress for all users when admin', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    const all = [
      { uuid: 'p1', user_id: 'u1', full_name: 'Ada Lovelace' },
      { uuid: 'p2', user_id: 'u2', full_name: 'Grace Hopper' },
    ];
    mockFindAllWithUsers.mockResolvedValue(all);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(all);
    expect(mockFindAllWithUsers).toHaveBeenCalled();
  });
});
