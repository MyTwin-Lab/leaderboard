import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockFindAssignees } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindAssignees: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
  },
  TaskAssigneeRepository: class {
    findAssignees = mockFindAssignees;
  },
}));

import { GET } from './route';

const TASK_ID = 'task-1';

function getAssignees() {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}/assignees`);
  return GET(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/tasks/[id]/assignees', () => {
  it('returns 404 when the task does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getAssignees();

    expect(res.status).toBe(404);
    expect(mockFindAssignees).not.toHaveBeenCalled();
  });

  it('returns the assignees of an existing task', async () => {
    mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Do the thing' });
    const assignees = [{ uuid: 'user-1', full_name: 'Ada Lovelace' }];
    mockFindAssignees.mockResolvedValue(assignees);

    const res = await getAssignees();

    expect(res.status).toBe(200);
    expect(mockFindAssignees).toHaveBeenCalledWith(TASK_ID);
    expect(await res.json()).toEqual(assignees);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getAssignees();

    expect(res.status).toBe(500);
  });
});
