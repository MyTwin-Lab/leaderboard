import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindByChallenge, mockCreate, mockChallengeFindById } = vi.hoisted(() => ({
  mockFindByChallenge: vi.fn(),
  mockCreate: vi.fn(),
  mockChallengeFindById: vi.fn(),
}));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findByChallenge = mockFindByChallenge;
    create = mockCreate;
  },
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
}));

import { GET, POST } from './route';

const CHALLENGE_ID = '11111111-1111-4111-8111-111111111111';

function getTasks(qs: string) {
  const req = new NextRequest(`http://localhost/api/tasks${qs}`);
  return GET(req);
}

function postTask(body: unknown) {
  const req = new NextRequest('http://localhost/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/tasks', () => {
  it('returns 400 when challenge_id is missing', async () => {
    const res = await getTasks('');

    expect(res.status).toBe(400);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('returns plain tasks', async () => {
    const tasks = [{ uuid: 'task-1' }];
    mockFindByChallenge.mockResolvedValue(tasks);

    const res = await getTasks(`?challenge_id=${CHALLENGE_ID}`);

    expect(res.status).toBe(200);
    expect(mockFindByChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(await res.json()).toEqual(tasks);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await getTasks(`?challenge_id=${CHALLENGE_ID}`);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/tasks', () => {
  const validBody = {
    challenge_id: CHALLENGE_ID,
    title: 'New task',
  };

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postTask({ challenge_id: 'not-a-uuid', title: 'New task' });

    expect(res.status).toBe(400);
    expect(mockChallengeFindById).not.toHaveBeenCalled();
  });

  it('returns 404 when the challenge does not exist', async () => {
    mockChallengeFindById.mockResolvedValue(null);

    const res = await postTask(validBody);

    expect(res.status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the challenge is an ML challenge', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml' });

    const res = await postTask(validBody);

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the task for a non-ML challenge', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code' });
    mockCreate.mockResolvedValue({ uuid: 'task-1', ...validBody, status: 'todo' });

    const res = await postTask(validBody);

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({ ...validBody, status: 'todo' });
    const body = await res.json();
    expect(body.uuid).toBe('task-1');
  });

  it('returns 500 when the repository throws', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code' });
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postTask(validBody);

    expect(res.status).toBe(500);
  });
});
