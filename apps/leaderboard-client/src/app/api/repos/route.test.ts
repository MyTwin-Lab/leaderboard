import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindAll, mockCreate, mockVerifyRequestToken, mockProjectFindById } = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockProjectFindById: vi.fn(),
}));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  RepoRepository: class {
    findAll = mockFindAll;
    create = mockCreate;
  },
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('@/lib/db', () => ({
  repositories: {
    project: { findById: mockProjectFindById },
  },
}));

import { GET, POST } from './route';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function postRepo(body: unknown) {
  const req = new NextRequest('http://localhost/api/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/repos', () => {
  it('returns all repos', async () => {
    const repos = [{ uuid: 'repo-1', title: 'Repo A' }];
    mockFindAll.mockResolvedValue(repos);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(repos);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindAll.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch repos' });
  });
});

describe('POST /api/repos', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await postRepo({ title: 'Repo A', type: 'github', project_id: PROJECT_ID });

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postRepo({ title: '', type: 'github', project_id: PROJECT_ID });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the repo for an admin without checking project ownership', async () => {
    const created = { uuid: 'repo-1', title: 'Repo A', type: 'github', project_id: PROJECT_ID };
    mockCreate.mockResolvedValue(created);

    const res = await postRepo({ title: 'Repo A', type: 'github', project_id: PROJECT_ID });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
    expect(mockProjectFindById).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage the project', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    mockProjectFindById.mockResolvedValue({ uuid: PROJECT_ID, manager_id: 'someone-else' });

    const res = await postRepo({ title: 'Repo A', type: 'github', project_id: PROJECT_ID });

    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin when the project does not exist', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    mockProjectFindById.mockResolvedValue(null);

    const res = await postRepo({ title: 'Repo A', type: 'github', project_id: PROJECT_ID });

    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the repo for a non-admin who manages the project', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    mockProjectFindById.mockResolvedValue({ uuid: PROJECT_ID, manager_id: 'u1' });
    const created = { uuid: 'repo-1', title: 'Repo A', type: 'github', project_id: PROJECT_ID };
    mockCreate.mockResolvedValue(created);

    const res = await postRepo({ title: 'Repo A', type: 'github', project_id: PROJECT_ID });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });

  it('returns 500 when the repository throws', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postRepo({ title: 'Repo A', type: 'github', project_id: PROJECT_ID });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to create repo' });
  });
});
