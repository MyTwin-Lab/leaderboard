import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockFindFullById, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockFindFullById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js', () => ({
  EvaluationGridsRepository: class {
    findFullById = mockFindFullById;
    update = mockUpdate;
    delete = mockDelete;
  },
}));

import { GET, PUT, DELETE } from './route';

const GRID_ID = 'grid-1';

function getGrid() {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}`);
  return GET(req, { params: Promise.resolve({ id: GRID_ID }) });
}

function putGrid(body: unknown) {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PUT(req, { params: Promise.resolve({ id: GRID_ID }) });
}

function deleteGrid() {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}`, { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: GRID_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/evaluation-grids/[id]', () => {
  it('returns the full grid', async () => {
    const grid = { uuid: GRID_ID, slug: 'code-review', name: 'Code Review', categories: [] };
    mockFindFullById.mockResolvedValue(grid);

    const res = await getGrid();

    expect(res.status).toBe(200);
    expect(mockFindFullById).toHaveBeenCalledWith(GRID_ID);
    expect(await res.json()).toEqual(grid);
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await getGrid();

    expect(res.status).toBe(403);
    expect(mockFindFullById).not.toHaveBeenCalled();
  });

  it('returns 404 when the grid does not exist', async () => {
    mockFindFullById.mockResolvedValue(null);

    const res = await getGrid();

    expect(res.status).toBe(404);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindFullById.mockRejectedValue(new Error('db down'));

    const res = await getGrid();

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/evaluation-grids/[id]', () => {
  it('updates the grid and returns it', async () => {
    const updated = { uuid: GRID_ID, name: 'New name' };
    mockUpdate.mockResolvedValue(updated);

    const res = await putGrid({ name: 'New name' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(GRID_ID, { name: 'New name' });
    expect(await res.json()).toEqual(updated);
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await putGrid({ name: 'New name' });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body (Zod)', async () => {
    const res = await putGrid({ status: 'not-a-valid-status' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));

    const res = await putGrid({ name: 'New name' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/evaluation-grids/[id]', () => {
  it('deletes the grid', async () => {
    mockDelete.mockResolvedValue(true);

    const res = await deleteGrid();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(GRID_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await deleteGrid();

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteGrid();

    expect(res.status).toBe(500);
  });
});
