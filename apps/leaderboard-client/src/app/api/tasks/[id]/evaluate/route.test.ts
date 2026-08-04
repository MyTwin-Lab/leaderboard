import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockFindById, mockIsUserAssigned, mockJwtVerify, mockEvaluateTask,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockIsUserAssigned: vi.fn(),
  mockJwtVerify: vi.fn(),
  mockEvaluateTask: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
  },
  TaskAssigneeRepository: class {
    isUserAssigned = mockIsUserAssigned;
  },
}));

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

vi.mock('../../../../../../../../packages/services/task_evaluation/task-evaluation.service', () => ({
  TaskEvaluationService: class {
    evaluateTask = mockEvaluateTask;
  },
}));

import { POST } from './route';

const TASK_ID = 'task-1';

function postEvaluate(withCookie = true) {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}/evaluate`, {
    method: 'POST',
    headers: withCookie ? { cookie: 'access_token=valid-token' } : undefined,
  });
  return POST(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'user-1', role: 'contributor' } });
  mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Do the thing' });
  mockIsUserAssigned.mockResolvedValue(true);
  mockEvaluateTask.mockResolvedValue({
    evaluation: { globalScore: 8, scores: { quality: 8 } },
    contribution: { uuid: 'contribution-1' },
    isUpdate: false,
  });
});

describe('POST /api/tasks/[id]/evaluate', () => {
  it('returns 401 when there is no session cookie', async () => {
    const res = await postEvaluate(false);

    expect(res.status).toBe(401);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('returns 404 when the task does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await postEvaluate();

    expect(res.status).toBe(404);
  });

  it('returns 403 when the caller is neither admin nor assignee', async () => {
    mockIsUserAssigned.mockResolvedValue(false);

    const res = await postEvaluate();

    expect(res.status).toBe(403);
    expect(mockEvaluateTask).not.toHaveBeenCalled();
  });

  it('evaluates the task for an assignee and shapes the response', async () => {
    const res = await postEvaluate();

    expect(res.status).toBe(200);
    expect(mockEvaluateTask).toHaveBeenCalledWith({ userId: 'user-1', taskId: TASK_ID });
    expect(await res.json()).toEqual({
      evaluation: { globalScore: 8, scores: { quality: 8 } },
      contribution: { uuid: 'contribution-1' },
      isUpdate: false,
    });
  });

  it('evaluates the task for an admin who is not an assignee', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'admin-1', role: 'admin' } });
    mockIsUserAssigned.mockResolvedValue(false);

    const res = await postEvaluate();

    expect(res.status).toBe(200);
    expect(mockEvaluateTask).toHaveBeenCalledWith({ userId: 'admin-1', taskId: TASK_ID });
  });

  it('returns 500 when the evaluation service throws', async () => {
    mockEvaluateTask.mockRejectedValue(new Error('evaluation failed'));

    const res = await postEvaluate();

    expect(res.status).toBe(500);
  });
});
