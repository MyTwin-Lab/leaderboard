import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindById, mockFindByChallengeAndContribution, mockDelete } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindById: vi.fn(),
  mockFindByChallengeAndContribution: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ValidationTargetRepository: class {
    findById = mockFindById;
    delete = mockDelete;
  },
  ValidationAttemptRepository: class {
    findByChallengeAndContribution = mockFindByChallengeAndContribution;
  },
}));

import { DELETE } from './route';

const CHALLENGE_ID = 'challenge-1';
const TARGET_ID = 'target-1';

function deleteTarget() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-targets/${TARGET_ID}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID, targetId: TARGET_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockFindByChallengeAndContribution.mockResolvedValue([]);
  mockDelete.mockResolvedValue(undefined);
});

describe('DELETE /api/challenges/[id]/validation-targets/[targetId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await deleteTarget();

    expect(res.status).toBe(401);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage this challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await deleteTarget();

    expect(res.status).toBe(403);
  });

  it('returns 404 when the target does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await deleteTarget();

    expect(res.status).toBe(404);
  });

  it('returns 404 when the target belongs to a different challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: TARGET_ID, validation_challenge_id: 'other-challenge', contribution_id: 'c1' });

    const res = await deleteTarget();

    expect(res.status).toBe(404);
  });

  it('returns 409 when the target already has votes', async () => {
    mockFindById.mockResolvedValue({ uuid: TARGET_ID, validation_challenge_id: CHALLENGE_ID, contribution_id: 'c1' });
    mockFindByChallengeAndContribution.mockResolvedValue([{ uuid: 'a1' }, { uuid: 'a2' }]);

    const res = await deleteTarget();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/2 vote/);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes the target and returns success when it has no votes', async () => {
    mockFindById.mockResolvedValue({ uuid: TARGET_ID, validation_challenge_id: CHALLENGE_ID, contribution_id: 'c1' });
    mockFindByChallengeAndContribution.mockResolvedValue([]);

    const res = await deleteTarget();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith(TARGET_ID);
  });

  it('returns 500 when a repository call throws', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await deleteTarget();

    expect(res.status).toBe(500);
  });
});
