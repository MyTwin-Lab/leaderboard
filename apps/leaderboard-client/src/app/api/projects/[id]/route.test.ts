import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  ProjectRepository: class {
    findById = mockFindById;
    update = mockUpdate;
    delete = mockDelete;
  },
}));

import { GET, PUT, DELETE } from './route';

const PROJECT_ID = 'project-1';

function params() {
  return { params: Promise.resolve({ id: PROJECT_ID }) };
}

function getProject() {
  const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}`);
  return GET(req, params());
}

function putProject(body: unknown) {
  const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PUT(req, params());
}

function deleteProject() {
  const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}`, { method: 'DELETE' });
  return DELETE(req, params());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/projects/[id]', () => {
  it('returns the project when found', async () => {
    const project = { uuid: PROJECT_ID, title: 'Leaderboard' };
    mockFindById.mockResolvedValue(project);

    const res = await getProject();

    expect(res.status).toBe(200);
    expect(mockFindById).toHaveBeenCalledWith(PROJECT_ID);
    expect(await res.json()).toEqual(project);
  });

  it('returns 404 when the project does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getProject();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Project not found' });
  });

  it('returns 500 when the repository throws', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getProject();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch project' });
  });
});

describe('PUT /api/projects/[id]', () => {
  it('updates the project with valid data', async () => {
    const updated = { uuid: PROJECT_ID, title: 'New title' };
    mockUpdate.mockResolvedValue(updated);

    const res = await putProject({ title: 'New title' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(PROJECT_ID, { title: 'New title' });
    expect(await res.json()).toEqual(updated);
  });

  it('returns 400 on invalid data (Zod)', async () => {
    const res = await putProject({ title: '' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when manager_id is not a uuid', async () => {
    const res = await putProject({ manager_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));

    const res = await putProject({ title: 'New title' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to update project' });
  });
});

describe('DELETE /api/projects/[id]', () => {
  it('deletes the project', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteProject();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(PROJECT_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteProject();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to delete project' });
  });
});
