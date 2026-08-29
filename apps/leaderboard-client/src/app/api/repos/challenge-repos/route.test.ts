import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockCreate, mockDelete } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepoRepository: class {
    create = mockCreate;
    delete = mockDelete;
  },
}));

import { POST, DELETE } from './route';

const CHALLENGE_ID = '11111111-1111-4111-8111-111111111111';
const REPO_ID = '22222222-2222-4222-8222-222222222222';

function postLink(body: unknown) {
  const req = new NextRequest('http://localhost/api/repos/challenge-repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

function deleteLink(qs: string) {
  const req = new NextRequest(`http://localhost/api/repos/challenge-repos${qs}`, {
    method: 'DELETE',
  });
  return DELETE(req);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/repos/challenge-repos', () => {
  it('links the repo to the challenge and returns 201', async () => {
    mockCreate.mockResolvedValue(undefined);

    const res = await postLink({ challenge_id: CHALLENGE_ID, repo_id: REPO_ID });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCreate).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, repo_id: REPO_ID });
  });

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postLink({ challenge_id: 'not-a-uuid', repo_id: REPO_ID });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postLink({ challenge_id: CHALLENGE_ID, repo_id: REPO_ID });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to link repo to challenge' });
  });
});

describe('DELETE /api/repos/challenge-repos', () => {
  it('unlinks the repo from the challenge', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteLink(`?challenge_id=${CHALLENGE_ID}&repo_id=${REPO_ID}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith(CHALLENGE_ID, REPO_ID);
  });

  it('returns 400 when challenge_id is missing', async () => {
    const res = await deleteLink(`?repo_id=${REPO_ID}`);

    expect(res.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 400 when repo_id is missing', async () => {
    const res = await deleteLink(`?challenge_id=${CHALLENGE_ID}`);

    expect(res.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteLink(`?challenge_id=${CHALLENGE_ID}&repo_id=${REPO_ID}`);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to unlink repo from challenge' });
  });
});
