import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
    update = mockUpdate;
    delete = mockDelete;
  },
}));

import { GET, PUT, DELETE } from './route';

const TASK_ID = 'task-1';

function getTask() {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}`);
  return GET(req, { params: Promise.resolve({ id: TASK_ID }) });
}

function putTask(body: unknown) {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PUT(req, { params: Promise.resolve({ id: TASK_ID }) });
}

function deleteTask() {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}`, { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/tasks/[id]', () => {
  it('returns 404 when the task does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getTask();

    expect(res.status).toBe(404);
  });

  it('returns the task when found', async () => {
    mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Do the thing' });

    const res = await getTask();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uuid: TASK_ID, title: 'Do the thing' });
  });
});

describe('PUT /api/tasks/[id]', () => {
  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await putTask({ status: 'not-a-valid-status' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates the task with the validated fields', async () => {
    mockUpdate.mockResolvedValue({ uuid: TASK_ID, title: 'Updated title' });

    const res = await putTask({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(TASK_ID, { title: 'Updated title' });
    expect(await res.json()).toEqual({ uuid: TASK_ID, title: 'Updated title' });
  });

  it('returns 500 when the repository throws', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));

    const res = await putTask({ title: 'Updated title' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/tasks/[id]', () => {
  it('deletes the task and returns success', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteTask();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(TASK_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteTask();

    expect(res.status).toBe(500);
  });
});
