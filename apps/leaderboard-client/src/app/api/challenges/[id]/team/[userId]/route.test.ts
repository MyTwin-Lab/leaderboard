import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDelete, mockGetSessionUser, mockIsManagerOfChallenge } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
}));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeTeamRepository: class {
    delete = mockDelete;
  },
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

import { DELETE } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = 'user-1';

function deleteMember() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/team/${USER_ID}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID, userId: USER_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockIsManagerOfChallenge.mockResolvedValue(false);
});

describe('DELETE /api/challenges/[id]/team/[userId]', () => {
  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await deleteMember();

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 403 to a contributor who does not manage the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'c1', role: 'contributor' });

    const res = await deleteMember();

    expect(res.status).toBe(403);
    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith('c1', CHALLENGE_ID);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('lets the manager of the challenge remove a member', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'm1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    const res = await deleteMember();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(CHALLENGE_ID, USER_ID);
  });

  it('removes the team member', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteMember();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(CHALLENGE_ID, USER_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteMember();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to remove team member' });
  });
});
