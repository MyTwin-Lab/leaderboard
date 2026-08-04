import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindByRepoWithAssignees } = vi.hoisted(() => ({
  mockFindByRepoWithAssignees: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskWorkspaceRepository: class {
    findByRepoWithAssignees = mockFindByRepoWithAssignees;
  },
}));

import { GET } from './route';

const REPO_ID = 'repo-1';

function getWorkspaces() {
  const req = new NextRequest(`http://localhost/api/repos/${REPO_ID}/workspaces`);
  return GET(req, { params: Promise.resolve({ id: REPO_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/repos/[id]/workspaces', () => {
  it('returns the workspaces linked to the repo', async () => {
    const workspaces = [{ uuid: 'ws-1', repo_id: REPO_ID }];
    mockFindByRepoWithAssignees.mockResolvedValue(workspaces);

    const res = await getWorkspaces();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(workspaces);
    expect(mockFindByRepoWithAssignees).toHaveBeenCalledWith(REPO_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByRepoWithAssignees.mockRejectedValue(new Error('db down'));

    const res = await getWorkspaces();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch repo workspaces' });
  });
});
