import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockFindSubcriteriaByCategory, mockCreateSubcriterion } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockFindSubcriteriaByCategory: vi.fn(),
  mockCreateSubcriterion: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js', () => ({
  EvaluationGridsRepository: class {
    findSubcriteriaByCategory = mockFindSubcriteriaByCategory;
    createSubcriterion = mockCreateSubcriterion;
  },
}));

import { GET, POST } from './route';

const GRID_ID = 'grid-1';
const CAT_ID = 'cat-1';

function getSubcriteria() {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}/categories/${CAT_ID}/subcriteria`);
  return GET(req, { params: Promise.resolve({ id: GRID_ID, catId: CAT_ID }) });
}

function postSubcriterion(body: unknown) {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}/categories/${CAT_ID}/subcriteria`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: GRID_ID, catId: CAT_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/evaluation-grids/[id]/categories/[catId]/subcriteria', () => {
  it('returns the subcriteria for the category', async () => {
    const subcriteria = [{ uuid: 'sub-1', criterion: 'Accuracy' }];
    mockFindSubcriteriaByCategory.mockResolvedValue(subcriteria);

    const res = await getSubcriteria();

    expect(res.status).toBe(200);
    expect(mockFindSubcriteriaByCategory).toHaveBeenCalledWith(CAT_ID);
    expect(await res.json()).toEqual(subcriteria);
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await getSubcriteria();

    expect(res.status).toBe(403);
    expect(mockFindSubcriteriaByCategory).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockFindSubcriteriaByCategory.mockRejectedValue(new Error('db down'));

    const res = await getSubcriteria();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/evaluation-grids/[id]/categories/[catId]/subcriteria', () => {
  it('creates the subcriterion under the category and returns 201', async () => {
    const created = { uuid: 'sub-1', category_id: CAT_ID, criterion: 'Accuracy', position: 0 };
    mockCreateSubcriterion.mockResolvedValue(created);

    const res = await postSubcriterion({ criterion: 'Accuracy' });

    expect(res.status).toBe(201);
    expect(mockCreateSubcriterion).toHaveBeenCalledWith({ category_id: CAT_ID, criterion: 'Accuracy', position: 0 });
    expect(await res.json()).toEqual(created);
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await postSubcriterion({ criterion: 'Accuracy' });

    expect(res.status).toBe(403);
    expect(mockCreateSubcriterion).not.toHaveBeenCalled();
  });

  it('returns 400 when criterion is missing (Zod)', async () => {
    const res = await postSubcriterion({});

    expect(res.status).toBe(400);
    expect(mockCreateSubcriterion).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockCreateSubcriterion.mockRejectedValue(new Error('db down'));

    const res = await postSubcriterion({ criterion: 'Accuracy' });

    expect(res.status).toBe(500);
  });
});
