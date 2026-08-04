import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockFindById, mockFindAssignees, mockFindByTaskWithRepo, mockFindSubTasks,
  mockChallengeFindById, mockFindByTaskAndUser, mockRepoFindById, mockJwtVerify,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindAssignees: vi.fn(),
  mockFindByTaskWithRepo: vi.fn(),
  mockFindSubTasks: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockFindByTaskAndUser: vi.fn(),
  mockRepoFindById: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
    findAssignees = mockFindAssignees;
    findSubTasks = mockFindSubTasks;
  },
  TaskAssigneeRepository: class {},
  TaskWorkspaceRepository: class {
    findByTaskWithRepo = mockFindByTaskWithRepo;
  },
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  ContributionRepository: class {
    findByTaskAndUser = mockFindByTaskAndUser;
  },
  RepoRepository: class {
    findById = mockRepoFindById;
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
  mockFindAssignees.mockResolvedValue([
    { uuid: 'user-1', full_name: 'Ada Lovelace', github_username: 'ada', avatar_url: 'http://a' },
  ]);
  mockFindByTaskWithRepo.mockResolvedValue([]);
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
    expect(body.assignees).toEqual([
      { uuid: 'user-1', full_name: 'Ada Lovelace', github_username: 'ada', avatar_url: 'http://a' },
    ]);
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

  it('enriches workspaces with repo info, defaulting to Unknown when the repo is missing', async () => {
    mockFindByTaskWithRepo.mockResolvedValue([
      { repo_id: 'repo-1', repo_type: 'github', repo_external_id: 'owner/repo', workspace_provider: 'github', workspace_ref: 'main', workspace_url: 'http://x', workspace_status: 'ready', workspace_meta: {} },
      { repo_id: 'repo-2', repo_type: 'github', repo_external_id: 'owner/repo2', workspace_provider: 'github', workspace_ref: 'main', workspace_url: 'http://y', workspace_status: 'ready', workspace_meta: {} },
    ]);
    mockRepoFindById.mockImplementation(async (id: string) => (id === 'repo-1' ? { title: 'Repo One' } : null));

    const res = await getDetails();

    const body = await res.json();
    expect(body.workspaces).toHaveLength(2);
    expect(body.workspaces[0].repo_title).toBe('Repo One');
    expect(body.workspaces[1].repo_title).toBe('Unknown');
  });

  it('returns 500 when a repository call fails', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getDetails();

    expect(res.status).toBe(500);
  });
});
