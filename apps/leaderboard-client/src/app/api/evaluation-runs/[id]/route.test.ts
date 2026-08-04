import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindWithChallenge, mockDelete } = vi.hoisted(() => ({
  mockFindWithChallenge: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  EvaluationRunsRepository: class {
    findWithChallenge = mockFindWithChallenge;
    delete = mockDelete;
  },
}));

import { GET, DELETE } from './route';

const RUN_ID = 'run-1';

function getRun() {
  const req = new NextRequest(`http://localhost/api/evaluation-runs/${RUN_ID}`);
  return GET(req, { params: Promise.resolve({ id: RUN_ID }) });
}

function deleteRun() {
  const req = new NextRequest(`http://localhost/api/evaluation-runs/${RUN_ID}`, { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: RUN_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/evaluation-runs/[id]', () => {
  it('returns 404 when the run does not exist', async () => {
    mockFindWithChallenge.mockResolvedValue(null);
    const res = await getRun();
    expect(res.status).toBe(404);
  });

  it('returns the run and its challenge on success', async () => {
    const result = { run: { uuid: RUN_ID, challenge_id: 'challenge-1' }, challenge: { uuid: 'challenge-1' } };
    mockFindWithChallenge.mockResolvedValue(result);

    const res = await getRun();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(mockFindWithChallenge).toHaveBeenCalledWith(RUN_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindWithChallenge.mockRejectedValue(new Error('db down'));
    const res = await getRun();
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/evaluation-runs/[id]', () => {
  it('deletes the run and returns success', async () => {
    mockDelete.mockResolvedValue(undefined);
    const res = await deleteRun();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith(RUN_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));
    const res = await deleteRun();
    expect(res.status).toBe(500);
  });
});
