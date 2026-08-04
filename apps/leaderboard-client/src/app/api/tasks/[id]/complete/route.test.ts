import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockCompleteTask, mockIsUserAssigned, mockJwtVerify } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockCompleteTask: vi.fn(),
  mockIsUserAssigned: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
    completeTask = mockCompleteTask;
  },
  TaskAssigneeRepository: class {
    isUserAssigned = mockIsUserAssigned;
  },
}));

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

import { PATCH } from './route';

const TASK_ID = 'task-1';

function patchComplete(withCookie = true) {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}/complete`, {
    method: 'PATCH',
    headers: withCookie ? { cookie: 'access_token=valid-token' } : undefined,
  });
  return PATCH(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'user-1', role: 'contributor' } });
  mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Do the thing' });
  mockIsUserAssigned.mockResolvedValue(true);
  mockCompleteTask.mockResolvedValue({ uuid: TASK_ID, status: 'done' });
});

describe('PATCH /api/tasks/[id]/complete', () => {
  it('returns 401 when there is no session cookie', async () => {
    const res = await patchComplete(false);

    expect(res.status).toBe(401);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('returns 401 when the token fails verification', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad token'));

    const res = await patchComplete();

    expect(res.status).toBe(401);
  });

  it('returns 404 when the task does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await patchComplete();

    expect(res.status).toBe(404);
  });

  it('returns 403 when the caller is neither admin nor assignee', async () => {
    mockIsUserAssigned.mockResolvedValue(false);

    const res = await patchComplete();

    expect(res.status).toBe(403);
    expect(mockCompleteTask).not.toHaveBeenCalled();
  });

  it('completes the task for an assignee', async () => {
    mockIsUserAssigned.mockResolvedValue(true);

    const res = await patchComplete();

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledWith(TASK_ID);
    expect(await res.json()).toEqual({ uuid: TASK_ID, status: 'done' });
  });

  it('completes the task for an admin who is not an assignee', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'admin-1', role: 'admin' } });
    mockIsUserAssigned.mockResolvedValue(false);

    const res = await patchComplete();

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledWith(TASK_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockCompleteTask.mockRejectedValue(new Error('db down'));

    const res = await patchComplete();

    expect(res.status).toBe(500);
  });
});
