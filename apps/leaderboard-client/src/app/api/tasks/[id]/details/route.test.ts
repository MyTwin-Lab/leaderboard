import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockFindById, mockFindSubTasks,
  mockChallengeFindById, mockFindByTaskAndUser, mockJwtVerify,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindSubTasks: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockFindByTaskAndUser: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
    findSubTasks = mockFindSubTasks;
  },
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  ContributionRepository: class {
    findByTaskAndUser = mockFindByTaskAndUser;
  },
}));

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

import { GET } from './route';

const TASK_ID = 'task-1';

function getDetails(withCookie = false) {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}/details`, {
    headers: withCookie ? { cookie: 'access_token=valid-token' } : undefined,
  });
  return GET(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Do the thing', challenge_id: 'challenge-1' });
  mockChallengeFindById.mockResolvedValue({
    uuid: 'challenge-1', title: 'Challenge', status: 'active', completion: 50, contribution_points_reward: 10,
  });
  mockFindSubTasks.mockResolvedValue([]);
  mockFindByTaskAndUser.mockResolvedValue(null);
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'user-1', role: 'contributor' } });
});

describe('GET /api/tasks/[id]/details', () => {
  it('returns 404 when the task does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getDetails();

    expect(res.status).toBe(404);
  });

  it('returns task details without a current user when unauthenticated', async () => {
    const res = await getDetails(false);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentUserId).toBeNull();
    expect(body.contribution).toBeNull();
    expect(mockFindByTaskAndUser).not.toHaveBeenCalled();
    expect(body.challenge).toEqual({
      uuid: 'challenge-1', title: 'Challenge', status: 'active', completion: 50, contribution_points_reward: 10,
    });
  });

  it('includes the current user contribution when authenticated', async () => {
    mockFindByTaskAndUser.mockResolvedValue({ uuid: 'contribution-1', status: 'validated' });

    const res = await getDetails(true);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentUserId).toBe('user-1');
    expect(mockFindByTaskAndUser).toHaveBeenCalledWith(TASK_ID, 'user-1');
    expect(body.contribution).toEqual({ uuid: 'contribution-1', status: 'validated' });
  });

  it('returns null challenge when the parent challenge no longer exists', async () => {
    mockChallengeFindById.mockResolvedValue(null);

    const res = await getDetails();

    const body = await res.json();
    expect(body.challenge).toBeNull();
  });

  it('returns 500 when a repository call fails', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getDetails();

    expect(res.status).toBe(500);
  });
});
