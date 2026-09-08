import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockJwtVerify,
  mockFindPersonalTasks, mockFindTemplateTasks, mockFindByChallenge, mockCreate, mockFindById,
  mockChallengeFindById,
  mockFindByChallengeAndUser,
  mockTeamFindByChallenge,
  mockProjectFindById,
} = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockFindPersonalTasks: vi.fn(),
  mockFindTemplateTasks: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockCreate: vi.fn(),
  mockFindById: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockFindByChallengeAndUser: vi.fn(),
  mockTeamFindByChallenge: vi.fn(),
  mockProjectFindById: vi.fn(),
}));

vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findPersonalTasks = mockFindPersonalTasks;
    findTemplateTasks = mockFindTemplateTasks;
    findByChallenge = mockFindByChallenge;
    create = mockCreate;
    findById = mockFindById;
  },
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  ChallengeTeamRepository: class {
    findByChallengeAndUser = mockFindByChallengeAndUser;
    // Lue par resolveWorkspaceOwner : vide = personne en groupe.
    findByChallenge = mockTeamFindByChallenge;
  },
}));

vi.mock('@/lib/db', () => ({
  repositories: {
    project: {
      findById: mockProjectFindById,
    },
  },
}));

import { GET, POST } from './route';

const CHALLENGE_ID = '11111111-1111-4111-8111-111111111111';
const PARENT_ID = '22222222-2222-4222-8222-222222222222';

function getTasks(query: string, token?: string) {
  const req = new NextRequest(`http://localhost/api/tasks${query}`, {
    headers: token ? { cookie: `access_token=${token}` } : undefined,
  });
  return GET(req);
}

function postTask(body: unknown, token?: string) {
  const req = new NextRequest('http://localhost/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { cookie: `access_token=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return POST(req);
}

const validBody = {
  challenge_id: CHALLENGE_ID,
  title: 'Do the thing',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindPersonalTasks.mockResolvedValue([{ uuid: 'personal-1' }]);
  mockFindTemplateTasks.mockResolvedValue([{ uuid: 'template-1' }]);
  mockFindByChallenge.mockResolvedValue([{ uuid: 'any-1' }]);
  mockCreate.mockImplementation(async (data: any) => ({ uuid: 'new-task', ...data }));
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', project_id: 'project-1' });
  mockFindByChallengeAndUser.mockResolvedValue({ uuid: 'membership-1' });
  mockProjectFindById.mockResolvedValue({ uuid: 'project-1', manager_id: 'manager-1' });
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'alice', role: 'contributor' } });
  mockTeamFindByChallenge.mockResolvedValue([]); // personne en groupe
});

describe('GET /api/tasks', () => {
  it('returns 401 for scope=mine without a session', async () => {
    const res = await getTasks(`?challenge_id=${CHALLENGE_ID}&scope=mine`);

    expect(res.status).toBe(401);
    expect(mockFindPersonalTasks).not.toHaveBeenCalled();
  });

  it('returns only findPersonalTasks(challengeId, userId) for scope=mine', async () => {
    const res = await getTasks(`?challenge_id=${CHALLENGE_ID}&scope=mine`, 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockFindPersonalTasks).toHaveBeenCalledWith(CHALLENGE_ID, 'alice');
    expect(mockFindTemplateTasks).not.toHaveBeenCalled();
    expect(mockFindByChallenge).not.toHaveBeenCalled();
    expect(body).toEqual([{ uuid: 'personal-1' }]);
  });

  it('returns findTemplateTasks(challengeId) for scope=template', async () => {
    const res = await getTasks(`?challenge_id=${CHALLENGE_ID}&scope=template`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockFindTemplateTasks).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(body).toEqual([{ uuid: 'template-1' }]);
  });
});

describe('POST /api/tasks', () => {
  it('returns 401 without a session', async () => {
    const res = await postTask(validBody);

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 403 for a personal task created by a non-member', async () => {
    mockFindByChallengeAndUser.mockResolvedValue(null);

    const res = await postTask(validBody, 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Join the challenge first');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a personal task for a member with user_id and status todo', async () => {
    const res = await postTask(validBody, 'valid-token');

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'alice', status: 'todo' })
    );
  });

  it('returns 403 for a template task created by a non-manager contributor', async () => {
    mockProjectFindById.mockResolvedValue({ uuid: 'project-1', manager_id: 'someone-else' });

    const res = await postTask({ ...validBody, template: true }, 'valid-token');

    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a template task for an admin with user_id null', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'admin-1', role: 'admin' } });

    const res = await postTask({ ...validBody, template: true }, 'valid-token');

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, status: 'todo' })
    );
  });

  it('returns 400 when parent_task_id points at a task from another challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: PARENT_ID, challenge_id: 'other-challenge', user_id: 'alice' });

    const res = await postTask({ ...validBody, parent_task_id: PARENT_ID }, 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Parent task not found on this challenge');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when parent_task_id points at a task from a different scope (template vs personal)', async () => {
    // Parent is a template task (user_id null) but the body creates a personal task.
    mockFindById.mockResolvedValue({ uuid: PARENT_ID, challenge_id: CHALLENGE_ID, user_id: null });

    const res = await postTask({ ...validBody, parent_task_id: PARENT_ID }, 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Parent task is not in the same scope');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for a challenge of type "ml"', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', project_id: 'project-1' });

    const res = await postTask(validBody, 'valid-token');

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
