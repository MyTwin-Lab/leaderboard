import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDelete } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  RepoRepository: class {
    delete = mockDelete;
  },
}));

import { DELETE } from './route';

const REPO_ID = 'repo-1';

function deleteRepo() {
  const req = new NextRequest(`http://localhost/api/repos/${REPO_ID}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id: REPO_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/repos/[id]', () => {
  it('deletes the repo and returns success', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteRepo();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith(REPO_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteRepo();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to delete repo' });
  });
});
