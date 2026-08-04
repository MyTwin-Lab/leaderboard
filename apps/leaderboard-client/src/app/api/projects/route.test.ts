import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindAll, mockCreate } = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  ProjectRepository: class {
    findAll = mockFindAll;
    create = mockCreate;
  },
}));

import { GET, POST } from './route';

function postProject(body: unknown) {
  const req = new NextRequest('http://localhost/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/projects', () => {
  it('returns the list of projects', async () => {
    const projects = [{ uuid: 'p1', title: 'Leaderboard' }, { uuid: 'p2', title: 'Other' }];
    mockFindAll.mockResolvedValue(projects);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(projects);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindAll.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch projects' });
  });
});

describe('POST /api/projects', () => {
  it('creates a project with valid data', async () => {
    const created = { uuid: 'p1', title: 'New project' };
    mockCreate.mockResolvedValue(created);

    const res = await postProject({ title: 'New project' });

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({ title: 'New project' });
    expect(await res.json()).toEqual(created);
  });

  it('returns 400 when title is missing (Zod)', async () => {
    const res = await postProject({ description: 'no title' });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when manager_id is not a uuid', async () => {
    const res = await postProject({ title: 'New project', manager_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postProject({ title: 'New project' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to create project' });
  });
});
