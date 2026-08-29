import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockFindCategoriesByGridId, mockCreateCategory } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockFindCategoriesByGridId: vi.fn(),
  mockCreateCategory: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js', () => ({
  EvaluationGridsRepository: class {
    findCategoriesByGridId = mockFindCategoriesByGridId;
    createCategory = mockCreateCategory;
  },
}));

import { GET, POST } from './route';

const GRID_ID = 'grid-1';

function getCategories() {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}/categories`);
  return GET(req, { params: Promise.resolve({ id: GRID_ID }) });
}

function postCategory(body: unknown) {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: GRID_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/evaluation-grids/[id]/categories', () => {
  it('returns the categories for the grid', async () => {
    const categories = [{ uuid: 'cat-1', name: 'Correctness' }];
    mockFindCategoriesByGridId.mockResolvedValue(categories);

    const res = await getCategories();

    expect(res.status).toBe(200);
    expect(mockFindCategoriesByGridId).toHaveBeenCalledWith(GRID_ID);
    expect(await res.json()).toEqual(categories);
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await getCategories();

    expect(res.status).toBe(403);
    expect(mockFindCategoriesByGridId).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockFindCategoriesByGridId.mockRejectedValue(new Error('db down'));

    const res = await getCategories();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/evaluation-grids/[id]/categories', () => {
  it('creates the category under the grid and returns 201', async () => {
    const created = { uuid: 'cat-1', grid_id: GRID_ID, name: 'Correctness', weight: 0.5, type: 'objective', position: 0 };
    mockCreateCategory.mockResolvedValue(created);

    const res = await postCategory({ name: 'Correctness', weight: 0.5, type: 'objective' });

    expect(res.status).toBe(201);
    expect(mockCreateCategory).toHaveBeenCalledWith({
      grid_id: GRID_ID,
      name: 'Correctness',
      weight: 0.5,
      type: 'objective',
      position: 0,
    });
    expect(await res.json()).toEqual(created);
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await postCategory({ name: 'Correctness', weight: 0.5, type: 'objective' });

    expect(res.status).toBe(403);
    expect(mockCreateCategory).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body (Zod)', async () => {
    const res = await postCategory({ name: 'Correctness', weight: 0.5, type: 'invalid-type' });

    expect(res.status).toBe(400);
    expect(mockCreateCategory).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockCreateCategory.mockRejectedValue(new Error('db down'));

    const res = await postCategory({ name: 'Correctness', weight: 0.5, type: 'objective' });

    expect(res.status).toBe(500);
  });
});
