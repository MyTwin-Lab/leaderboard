import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken,
  mockChallengeFindById,
  mockChallengeTeamFindByChallengeAndUser,
  mockChallengeTeamCreate,
  mockChallengeTeamUpdateWorkspace,
  mockTaskFindTemplateTasks,
  mockTaskCreate,
  mockChallengeRepoFindByChallengeWithRepo,
  mockUserFindById,
  mockProvisionContributorWorkspace,
  mockGetProvider,
  mockMapRepoTypeToWorkspaceType,
  mockProtect,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockChallengeTeamFindByChallengeAndUser: vi.fn(),
  mockChallengeTeamCreate: vi.fn(),
  mockChallengeTeamUpdateWorkspace: vi.fn(),
  mockTaskFindTemplateTasks: vi.fn(),
  mockTaskCreate: vi.fn(),
  mockChallengeRepoFindByChallengeWithRepo: vi.fn(),
  mockUserFindById: vi.fn(),
  mockProvisionContributorWorkspace: vi.fn(),
  mockGetProvider: vi.fn(),
  mockMapRepoTypeToWorkspaceType: vi.fn(),
  mockProtect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyRequestToken: mockVerifyRequestToken,
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  ChallengeRepoRepository: class {
    findByChallengeWithRepo = mockChallengeRepoFindByChallengeWithRepo;
  },
  ChallengeTeamRepository: class {
    findByChallengeAndUser = mockChallengeTeamFindByChallengeAndUser;
    create = mockChallengeTeamCreate;
    updateWorkspace = mockChallengeTeamUpdateWorkspace;
  },
  TaskRepository: class {
    findTemplateTasks = mockTaskFindTemplateTasks;
    create = mockTaskCreate;
  },
  UserRepository: class {
    findById = mockUserFindById;
  },
}));

vi.mock('../../../../../../../../packages/provisioner/src/index.js', () => ({
  provisionContributorWorkspace: mockProvisionContributorWorkspace,
  ProvisionerRegistry: {
    getProvider: mockGetProvider,
  },
  mapRepoTypeToWorkspaceType: mockMapRepoTypeToWorkspaceType,
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';

function joinChallenge() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/join`, {
    method: 'POST',
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'alice' });
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', workspace_mode: 'provided_repo', index: 3 });
  mockChallengeTeamFindByChallengeAndUser.mockResolvedValue(null);
  mockChallengeTeamCreate.mockResolvedValue({});
  mockChallengeTeamUpdateWorkspace.mockResolvedValue({});
  mockTaskFindTemplateTasks.mockResolvedValue([]);
  mockTaskCreate.mockImplementation(async (data: any) => ({ uuid: `created-${Math.random()}`, ...data }));
  mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([]);
  mockUserFindById.mockResolvedValue({ uuid: 'alice', full_name: 'Alice', github_username: 'alice-gh' });
  mockProvisionContributorWorkspace.mockResolvedValue({ ref: 'refs/heads/contrib/3-alice-gh', url: 'https://github.com/acme/repo/tree/contrib/3-alice-gh', status: 'ready' });
  mockMapRepoTypeToWorkspaceType.mockReturnValue('git_branch');
  mockGetProvider.mockReturnValue({ protect: mockProtect });
  mockProtect.mockResolvedValue(undefined);
});

describe('POST /api/challenges/[id]/join', () => {
  it('returns 401 without a session', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await joinChallenge();

    expect(res.status).toBe(401);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when already a member', async () => {
    mockChallengeTeamFindByChallengeAndUser.mockResolvedValue({ challenge_id: CHALLENGE_ID, user_id: 'alice' });

    const res = await joinChallenge();

    expect(res.status).toBe(409);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('code + provided_repo: creates the team row, copies the template board, and provisions the personal branch', async () => {
    mockTaskFindTemplateTasks.mockResolvedValue([
      { uuid: 't1', parent_task_id: null, title: 'Parent 1', description: 'd1' },
      { uuid: 't2', parent_task_id: null, title: 'Parent 2', description: 'd2' },
      { uuid: 't3', parent_task_id: 't1', title: 'Child of 1', description: 'd3' },
    ]);
    mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([
      { challenge_id: CHALLENGE_ID, repo_id: 'repo-1', repo_type: 'github', repo_external_id: 'acme/widgets', workspace_ref: 'refs/heads/challenge/3' },
    ]);

    const res = await joinChallenge();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.tasksCreated).toBe(3);

    expect(mockChallengeTeamCreate).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID,
      user_id: 'alice',
      workspace_provider: 'github',
      workspace_status: 'pending',
    });

    // 3 tasks created: 2 parents then the child.
    expect(mockTaskCreate).toHaveBeenCalledTimes(3);
    const calls = mockTaskCreate.mock.calls.map(([args]: any[]) => args);
    expect(calls[0]).toEqual(expect.objectContaining({ title: 'Parent 1', user_id: 'alice', status: 'todo' }));
    expect(calls[1]).toEqual(expect.objectContaining({ title: 'Parent 2', user_id: 'alice', status: 'todo' }));
    // The child's parent_task_id must point at the COPY of parent 1, not the original template uuid.
    const parent1CopyResult = await mockTaskCreate.mock.results[0].value;
    expect(calls[2]).toEqual(expect.objectContaining({ title: 'Child of 1', parent_task_id: parent1CopyResult.uuid }));
    expect(calls[2].parent_task_id).not.toBe('t1');

    // Provisioning happened using the challenge's linked repo.
    expect(mockProvisionContributorWorkspace).toHaveBeenCalledWith({
      challengeIndex: 3,
      username: 'alice-gh',
      repoExternalId: 'acme/widgets',
      repoType: 'github',
      challengeBranchRef: 'refs/heads/challenge/3',
    });
    expect(mockChallengeTeamUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'alice', {
      workspace_ref: 'refs/heads/contrib/3-alice-gh',
      workspace_url: 'https://github.com/acme/repo/tree/contrib/3-alice-gh',
      workspace_status: 'ready',
    });
    expect(mockProtect).toHaveBeenCalledWith('acme/widgets', 'refs/heads/contrib/3-alice-gh', ['alice-gh']);
  });

  it('code + own_repo: sets workspace_provider external and never calls the provisioner', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', workspace_mode: 'own_repo', index: 3 });

    const res = await joinChallenge();

    expect(res.status).toBe(201);
    expect(mockChallengeTeamCreate).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID,
      user_id: 'alice',
      workspace_provider: 'external',
    });
    expect(mockProvisionContributorWorkspace).not.toHaveBeenCalled();
    expect(mockChallengeRepoFindByChallengeWithRepo).not.toHaveBeenCalled();
  });

  it('ml challenge: creates a simple team row with no template copy or provisioning', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', index: 3 });

    const res = await joinChallenge();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.tasksCreated).toBe(0);
    expect(mockChallengeTeamCreate).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID,
      user_id: 'alice',
    });
    expect(mockTaskFindTemplateTasks).not.toHaveBeenCalled();
    expect(mockProvisionContributorWorkspace).not.toHaveBeenCalled();
  });

  it('provisioner failure: marks the workspace failed but still returns 201', async () => {
    mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([
      { challenge_id: CHALLENGE_ID, repo_id: 'repo-1', repo_type: 'github', repo_external_id: 'acme/widgets', workspace_ref: 'refs/heads/challenge/3' },
    ]);
    mockProvisionContributorWorkspace.mockRejectedValue(new Error('GitHub API down'));

    const res = await joinChallenge();

    expect(res.status).toBe(201);
    expect(mockChallengeTeamUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, 'alice', { workspace_status: 'failed' });
  });
});
