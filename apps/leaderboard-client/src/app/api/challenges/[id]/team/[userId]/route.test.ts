import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDelete } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
}));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeTeamRepository: class {
    delete = mockDelete;
  },
}));

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
});

describe('DELETE /api/challenges/[id]/team/[userId]', () => {
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
