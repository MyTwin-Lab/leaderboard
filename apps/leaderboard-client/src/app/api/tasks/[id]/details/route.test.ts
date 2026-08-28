import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockFindSubTasks } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindSubTasks: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
    findSubTasks = mockFindSubTasks;
  },
}));

import { GET } from './route';

const TASK_ID = 'task-1';

function getDetails() {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}/details`);
  return GET(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Do the thing', challenge_id: 'challenge-1' });
  mockFindSubTasks.mockResolvedValue([]);
});

describe('GET /api/tasks/[id]/details', () => {
  it('returns 404 when the task does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getDetails();

    expect(res.status).toBe(404);
    expect(mockFindSubTasks).not.toHaveBeenCalled();
  });

  it('returns { task, subTasks } when found', async () => {
    mockFindSubTasks.mockResolvedValue([{ uuid: 'sub-1', title: 'Sub task' }]);

    const res = await getDetails();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      task: { uuid: TASK_ID, title: 'Do the thing', challenge_id: 'challenge-1' },
      subTasks: [{ uuid: 'sub-1', title: 'Sub task' }],
    });
    expect(mockFindSubTasks).toHaveBeenCalledWith(TASK_ID);
  });

  it('returns 500 when a repository call fails', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getDetails();

    expect(res.status).toBe(500);
  });
});
