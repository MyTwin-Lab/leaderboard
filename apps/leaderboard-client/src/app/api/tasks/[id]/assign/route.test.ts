import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockTaskFindById, mockIsUserAssigned, mockCountAssignees, mockAssignUser, mockUnassignUser,
  mockChallengeTeamFindByChallenge, mockChallengeTeamCreate,
  mockChallengeFindById, mockChallengeRepoFindByChallengeWithRepo,
  mockTaskWorkspaceFindByTaskAndRepo, mockTaskWorkspaceCreate, mockTaskWorkspaceUpdateWorkspace,
  mockUserFindById, mockProvisionTaskWorkspace, mockGetProvider, mockMapRepoTypeToWorkspaceType,
  mockJwtVerify,
} = vi.hoisted(() => ({
  mockTaskFindById: vi.fn(),
  mockIsUserAssigned: vi.fn(),
  mockCountAssignees: vi.fn(),
  mockAssignUser: vi.fn(),
  mockUnassignUser: vi.fn(),
  mockChallengeTeamFindByChallenge: vi.fn(),
  mockChallengeTeamCreate: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockChallengeRepoFindByChallengeWithRepo: vi.fn(),
  mockTaskWorkspaceFindByTaskAndRepo: vi.fn(),
  mockTaskWorkspaceCreate: vi.fn(),
  mockTaskWorkspaceUpdateWorkspace: vi.fn(),
  mockUserFindById: vi.fn(),
  mockProvisionTaskWorkspace: vi.fn(),
  mockGetProvider: vi.fn(),
  mockMapRepoTypeToWorkspaceType: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class { findById = mockTaskFindById; },
  TaskAssigneeRepository: class {
    isUserAssigned = mockIsUserAssigned;
    countAssignees = mockCountAssignees;
    assignUser = mockAssignUser;
    unassignUser = mockUnassignUser;
  },
  ChallengeRepository: class { findById = mockChallengeFindById; },
  ChallengeRepoRepository: class { findByChallengeWithRepo = mockChallengeRepoFindByChallengeWithRepo; },
  ChallengeTeamRepository: class {
    findByChallenge = mockChallengeTeamFindByChallenge;
    create = mockChallengeTeamCreate;
  },
  TaskWorkspaceRepository: class {
    findByTaskAndRepo = mockTaskWorkspaceFindByTaskAndRepo;
    create = mockTaskWorkspaceCreate;
    updateWorkspace = mockTaskWorkspaceUpdateWorkspace;
  },
  UserRepository: class { findById = mockUserFindById; },
}));

vi.mock('../../../../../../../../packages/provisioner/src/index.js', () => ({
  provisionTaskWorkspace: mockProvisionTaskWorkspace,
  ProvisionerRegistry: { getProvider: mockGetProvider },
}));

vi.mock('../../../../../../../../packages/provisioner/src/utils.js', () => ({
  mapRepoTypeToWorkspaceType: mockMapRepoTypeToWorkspaceType,
}));

vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

import { POST, DELETE } from './route';

const TASK_ID = 'task-1';
const USER_ID = 'user-1';
const CHALLENGE_ID = 'challenge-1';

function buildRequest(method: string, withToken = true) {
  const headers: Record<string, string> = {};
  if (withToken) headers['Cookie'] = 'access_token=valid-token';
  return new NextRequest(`http://localhost/api/tasks/${TASK_ID}/assign`, { method, headers });
}

function postAssign(withToken = true) {
  return POST(buildRequest('POST', withToken), { params: Promise.resolve({ id: TASK_ID }) });
}

function deleteAssign(withToken = true) {
  return DELETE(buildRequest('DELETE', withToken), { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: USER_ID } });
  mockTaskFindById.mockResolvedValue({
    uuid: TASK_ID, title: 'Some task', type: 'team', challenge_id: CHALLENGE_ID, repo_id: null,
  });
  mockIsUserAssigned.mockResolvedValue(false);
  mockCountAssignees.mockResolvedValue(0);
  mockAssignUser.mockResolvedValue({ task_id: TASK_ID, user_id: USER_ID });
  mockUnassignUser.mockResolvedValue(undefined);
  mockChallengeTeamFindByChallenge.mockResolvedValue([{ user_id: USER_ID }]);
  mockChallengeTeamCreate.mockResolvedValue(undefined);
  mockChallengeFindById.mockResolvedValue(null);
  mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([]);
  mockTaskWorkspaceFindByTaskAndRepo.mockResolvedValue(null);
  mockTaskWorkspaceCreate.mockResolvedValue(undefined);
  mockTaskWorkspaceUpdateWorkspace.mockResolvedValue(undefined);
  mockUserFindById.mockResolvedValue({ uuid: USER_ID, github_username: 'octocat' });
  mockProvisionTaskWorkspace.mockResolvedValue({
    provider: 'github', ref: 'ref-1', url: 'http://workspace', status: 'ready', meta: {},
  });
  mockGetProvider.mockReturnValue({ protect: vi.fn().mockResolvedValue(undefined) });
  mockMapRepoTypeToWorkspaceType.mockReturnValue('github');
});

describe('POST /api/tasks/[id]/assign', () => {
  it('returns 401 when there is no access_token cookie', async () => {
    const res = await postAssign(false);
    expect(res.status).toBe(401);
    expect(mockTaskFindById).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is invalid', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad token'));
    const res = await postAssign();
    expect(res.status).toBe(401);
  });

  it('returns 404 when the task does not exist', async () => {
    mockTaskFindById.mockResolvedValue(null);
    const res = await postAssign();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Task not found');
  });

  it('returns 400 when the user is already assigned', async () => {
    mockIsUserAssigned.mockResolvedValue(true);
    const res = await postAssign();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('You are already assigned to this task');
    expect(mockAssignUser).not.toHaveBeenCalled();
  });

  it('returns 400 when a solo task already has an assignee', async () => {
    mockTaskFindById.mockResolvedValue({
      uuid: TASK_ID, title: 'Solo task', type: 'solo', challenge_id: CHALLENGE_ID, repo_id: null,
    });
    mockCountAssignees.mockResolvedValue(1);
    const res = await postAssign();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('This is a solo task and someone is already assigned');
    expect(mockAssignUser).not.toHaveBeenCalled();
  });

  it('adds the user to the challenge team when not already a member, then assigns them', async () => {
    mockChallengeTeamFindByChallenge.mockResolvedValue([]);

    const res = await postAssign();

    expect(res.status).toBe(201);
    expect(mockChallengeTeamCreate).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, user_id: USER_ID });
    expect(mockAssignUser).toHaveBeenCalledWith(TASK_ID, USER_ID);
    const body = await res.json();
    expect(body.assignment).toEqual({ task_id: TASK_ID, user_id: USER_ID });
    expect(body.provisioning).toEqual([]);
  });

  it('does not re-add the user to the challenge team when already a member', async () => {
    const res = await postAssign();
    expect(res.status).toBe(201);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('skips provisioning when the task has no repo_id', async () => {
    const res = await postAssign();
    expect(res.status).toBe(201);
    expect(mockChallengeRepoFindByChallengeWithRepo).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.provisioning).toEqual([]);
  });

  it('skips provisioning when the matching challenge repo has no external id', async () => {
    mockTaskFindById.mockResolvedValue({
      uuid: TASK_ID, title: 'Task', type: 'team', challenge_id: CHALLENGE_ID, repo_id: 'repo-1',
    });
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, index: 1 });
    mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([
      { repo_id: 'repo-1', repo_type: 'github', repo_external_id: null, workspace_ref: null },
    ]);

    const res = await postAssign();

    expect(res.status).toBe(201);
    expect(mockProvisionTaskWorkspace).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.provisioning).toEqual([]);
  });

  it('skips provisioning when no challenge repo matches the task repo_id', async () => {
    mockTaskFindById.mockResolvedValue({
      uuid: TASK_ID, title: 'Task', type: 'team', challenge_id: CHALLENGE_ID, repo_id: 'repo-1',
    });
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, index: 1 });
    mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([
      { repo_id: 'other-repo', repo_type: 'github', repo_external_id: 'ext-1', workspace_ref: null },
    ]);

    const res = await postAssign();

    expect(res.status).toBe(201);
    expect(mockProvisionTaskWorkspace).not.toHaveBeenCalled();
  });

  it('provisions a new workspace and protects it when the task has a repo', async () => {
    mockTaskFindById.mockResolvedValue({
      uuid: TASK_ID, title: 'Task', type: 'team', challenge_id: CHALLENGE_ID, repo_id: 'repo-1',
    });
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, index: 1 });
    mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([
      { repo_id: 'repo-1', repo_type: 'github', repo_external_id: 'ext-1', workspace_ref: 'main' },
    ]);
    const protect = vi.fn().mockResolvedValue(undefined);
    mockGetProvider.mockReturnValue({ protect });

    const res = await postAssign();

    expect(res.status).toBe(201);
    expect(mockProvisionTaskWorkspace).toHaveBeenCalledWith({
      challengeIndex: 1,
      taskTitle: 'Task',
      repoExternalId: 'ext-1',
      repoType: 'github',
      challengeBranchRef: 'main',
    });
    expect(mockTaskWorkspaceCreate).toHaveBeenCalled();
    expect(protect).toHaveBeenCalledWith('ext-1', 'ref-1', ['octocat']);
    const body = await res.json();
    expect(body.provisioning).toEqual([
      { repo_id: 'repo-1', status: 'ready', result: expect.any(Object) },
    ]);
  });

  it('reports an existing ready workspace as already_exists without re-provisioning', async () => {
    mockTaskFindById.mockResolvedValue({
      uuid: TASK_ID, title: 'Task', type: 'team', challenge_id: CHALLENGE_ID, repo_id: 'repo-1',
    });
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, index: 1 });
    mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([
      { repo_id: 'repo-1', repo_type: 'github', repo_external_id: 'ext-1', workspace_ref: 'main' },
    ]);
    const existingWorkspace = { task_id: TASK_ID, repo_id: 'repo-1', workspace_status: 'ready' };
    mockTaskWorkspaceFindByTaskAndRepo.mockResolvedValue(existingWorkspace);

    const res = await postAssign();

    expect(res.status).toBe(201);
    expect(mockProvisionTaskWorkspace).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.provisioning).toEqual([
      { repo_id: 'repo-1', status: 'already_exists', workspace: existingWorkspace },
    ]);
  });

  it('records a failed workspace and still returns 201 when provisioning throws', async () => {
    mockTaskFindById.mockResolvedValue({
      uuid: TASK_ID, title: 'Task', type: 'team', challenge_id: CHALLENGE_ID, repo_id: 'repo-1',
    });
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, index: 1 });
    mockChallengeRepoFindByChallengeWithRepo.mockResolvedValue([
      { repo_id: 'repo-1', repo_type: 'github', repo_external_id: 'ext-1', workspace_ref: 'main' },
    ]);
    mockProvisionTaskWorkspace.mockRejectedValue(new Error('provisioning failed'));

    const res = await postAssign();

    expect(res.status).toBe(201);
    expect(mockTaskWorkspaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      task_id: TASK_ID,
      repo_id: 'repo-1',
      workspace_status: 'failed',
      workspace_meta: { error: 'provisioning failed' },
    }));
    const body = await res.json();
    expect(body.provisioning).toEqual([
      { repo_id: 'repo-1', status: 'failed', error: 'provisioning failed' },
    ]);
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockTaskFindById.mockRejectedValue(new Error('db down'));
    const res = await postAssign();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to assign to task');
  });
});

describe('DELETE /api/tasks/[id]/assign', () => {
  it('returns 401 when there is no access_token cookie', async () => {
    const res = await deleteAssign(false);
    expect(res.status).toBe(401);
    expect(mockTaskFindById).not.toHaveBeenCalled();
  });

  it('returns 404 when the task does not exist', async () => {
    mockTaskFindById.mockResolvedValue(null);
    const res = await deleteAssign();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Task not found');
  });

  it('returns 400 when the user is not assigned', async () => {
    mockIsUserAssigned.mockResolvedValue(false);
    const res = await deleteAssign();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('You are not assigned to this task');
    expect(mockUnassignUser).not.toHaveBeenCalled();
  });

  it('unassigns the user and returns success', async () => {
    mockIsUserAssigned.mockResolvedValue(true);
    const res = await deleteAssign();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockUnassignUser).toHaveBeenCalledWith(TASK_ID, USER_ID);
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockTaskFindById.mockRejectedValue(new Error('db down'));
    const res = await deleteAssign();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to unassign from task');
  });
});
