import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockJwtVerify,
  mockFindById, mockUpdate, mockDelete,
  mockChallengeFindById,
  mockProjectFindById,
} = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockProjectFindById: vi.fn(),
}));

vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
    update = mockUpdate;
    delete = mockDelete;
  },
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
}));

vi.mock('@/lib/db', () => ({
  repositories: {
    project: {
      findById: mockProjectFindById,
    },
  },
}));

import { GET, PATCH, DELETE } from './route';

const TASK_ID = 'task-1';
const PARENT_ID = '22222222-2222-4222-8222-222222222222';

function getTask(token?: string) {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}`, {
    headers: token ? { cookie: `access_token=${token}` } : undefined,
  });
  return GET(req, { params: Promise.resolve({ id: TASK_ID }) });
}

function patchTask(body: unknown, token?: string) {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { cookie: `access_token=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: TASK_ID }) });
}

function deleteTask(token?: string) {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}`, {
    method: 'DELETE',
    headers: token ? { cookie: `access_token=${token}` } : undefined,
  });
  return DELETE(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Do the thing', user_id: 'alice', challenge_id: 'challenge-1' });
  mockUpdate.mockImplementation(async (id: string, data: any) => ({ uuid: id, ...data }));
  mockDelete.mockResolvedValue(undefined);
  mockChallengeFindById.mockResolvedValue({ uuid: 'challenge-1', project_id: 'project-1' });
  mockProjectFindById.mockResolvedValue({ uuid: 'project-1', manager_id: 'manager-1' });
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'alice', role: 'contributor' } });
});

describe('GET /api/tasks/[id]', () => {
  it('returns the task when found (unchanged)', async () => {
    const res = await getTask();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({ uuid: TASK_ID, title: 'Do the thing' })
    );
  });
});

describe('PATCH /api/tasks/[id]', () => {
  it('allows the owner to update their task', async () => {
    const res = await patchTask({ status: 'done' }, 'valid-token');

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(TASK_ID, { status: 'done' });
  });

  it('returns 403 when another user tries to update the task', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'bob', role: 'contributor' } });

    const res = await patchTask({ status: 'done' }, 'valid-token');

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 for a contributor updating a template task, 200 for an admin', async () => {
    mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Template', user_id: null, challenge_id: 'challenge-1' });

    const resContributor = await patchTask({ status: 'done' }, 'valid-token');
    expect(resContributor.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();

    mockJwtVerify.mockResolvedValue({ payload: { userId: 'admin-1', role: 'admin' } });
    const resAdmin = await patchTask({ status: 'done' }, 'valid-token');
    expect(resAdmin.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(TASK_ID, { status: 'done' });
  });

  it('lets the owner detach a sub-task by sending parent_task_id: null', async () => {
    const res = await patchTask({ parent_task_id: null }, 'valid-token');

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(TASK_ID, { parent_task_id: null });
  });

  it('returns 400 when parent_task_id points at a task from another challenge', async () => {
    mockFindById
      .mockResolvedValueOnce({ uuid: TASK_ID, title: 'Do the thing', user_id: 'alice', challenge_id: 'challenge-1' }) // canTouchTask
      .mockResolvedValueOnce({ uuid: TASK_ID, user_id: 'alice', challenge_id: 'challenge-1' }) // current, in validation
      .mockResolvedValueOnce({ uuid: PARENT_ID, user_id: 'alice', challenge_id: 'other-challenge' }); // parent

    const res = await patchTask({ parent_task_id: PARENT_ID }, 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Parent task is not in the same scope');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when parent_task_id points at a task from a different scope', async () => {
    mockFindById
      .mockResolvedValueOnce({ uuid: TASK_ID, title: 'Do the thing', user_id: 'alice', challenge_id: 'challenge-1' }) // canTouchTask
      .mockResolvedValueOnce({ uuid: TASK_ID, user_id: 'alice', challenge_id: 'challenge-1' }) // current
      .mockResolvedValueOnce({ uuid: PARENT_ID, user_id: 'bob', challenge_id: 'challenge-1' }); // parent, owned by someone else

    const res = await patchTask({ parent_task_id: PARENT_ID }, 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Parent task is not in the same scope');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid status', async () => {
    const res = await patchTask({ status: 'not-a-status' }, 'valid-token');

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/tasks/[id]', () => {
  it('allows the owner to delete and returns 403 for another user', async () => {
    const resOwner = await deleteTask('valid-token');
    expect(resOwner.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(TASK_ID);

    mockDelete.mockClear();
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'bob', role: 'contributor' } });
    const resOther = await deleteTask('valid-token');
    expect(resOther.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
