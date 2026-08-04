import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindWithChallenge, mockDelete, mockJwtVerify } = vi.hoisted(() => ({
  mockFindWithChallenge: vi.fn(),
  mockDelete: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  EvaluationRunsRepository: class {
    findWithChallenge = mockFindWithChallenge;
    delete = mockDelete;
  },
}));

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

import { GET, DELETE } from './route';

const RUN_ID = 'run-1';

function getRun(withCookie = true) {
  const req = new NextRequest(`http://localhost/api/evaluation-runs/${RUN_ID}`, {
    headers: withCookie ? { cookie: 'access_token=valid-token' } : undefined,
  });
  return GET(req, { params: Promise.resolve({ id: RUN_ID }) });
}

function deleteRun(withCookie = true) {
  const req = new NextRequest(`http://localhost/api/evaluation-runs/${RUN_ID}`, {
    method: 'DELETE',
    headers: withCookie ? { cookie: 'access_token=valid-token' } : undefined,
  });
  return DELETE(req, { params: Promise.resolve({ id: RUN_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'admin-1', role: 'admin' } });
});

describe('GET /api/evaluation-runs/[id]', () => {
  it('returns 401 when there is no access_token cookie', async () => {
    const res = await getRun(false);
    expect(res.status).toBe(401);
    expect(mockFindWithChallenge).not.toHaveBeenCalled();
  });

  it('returns 401 when the token fails verification', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad token'));
    const res = await getRun();
    expect(res.status).toBe(401);
    expect(mockFindWithChallenge).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not an admin', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'user-1', role: 'contributor' } });
    const res = await getRun();
    expect(res.status).toBe(403);
    expect(mockFindWithChallenge).not.toHaveBeenCalled();
  });

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
  it('returns 401 when there is no access_token cookie', async () => {
    const res = await deleteRun(false);
    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not an admin', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'user-1', role: 'contributor' } });
    const res = await deleteRun();
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

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
