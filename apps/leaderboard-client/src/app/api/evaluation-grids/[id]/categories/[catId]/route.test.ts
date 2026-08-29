import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockUpdateCategory, mockDeleteCategory } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockUpdateCategory: vi.fn(),
  mockDeleteCategory: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js', () => ({
  EvaluationGridsRepository: class {
    updateCategory = mockUpdateCategory;
    deleteCategory = mockDeleteCategory;
  },
}));

import { PUT, DELETE } from './route';

const GRID_ID = 'grid-1';
const CAT_ID = 'cat-1';

function putCategory(body: unknown) {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}/categories/${CAT_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PUT(req, { params: Promise.resolve({ id: GRID_ID, catId: CAT_ID }) });
}

function deleteCategory() {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}/categories/${CAT_ID}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id: GRID_ID, catId: CAT_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('PUT /api/evaluation-grids/[id]/categories/[catId]', () => {
  it('updates the category and returns it', async () => {
    const updated = { uuid: CAT_ID, name: 'New name', weight: 0.5 };
    mockUpdateCategory.mockResolvedValue(updated);

    const res = await putCategory({ name: 'New name', weight: 0.5 });

    expect(res.status).toBe(200);
    expect(mockUpdateCategory).toHaveBeenCalledWith(CAT_ID, { name: 'New name', weight: 0.5 });
    expect(await res.json()).toEqual(updated);
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await putCategory({ name: 'New name' });

    expect(res.status).toBe(403);
    expect(mockUpdateCategory).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body (Zod)', async () => {
    const res = await putCategory({ weight: 5 });

    expect(res.status).toBe(400);
    expect(mockUpdateCategory).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockUpdateCategory.mockRejectedValue(new Error('db down'));

    const res = await putCategory({ name: 'New name' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/evaluation-grids/[id]/categories/[catId]', () => {
  it('deletes the category', async () => {
    mockDeleteCategory.mockResolvedValue(true);

    const res = await deleteCategory();

    expect(res.status).toBe(200);
    expect(mockDeleteCategory).toHaveBeenCalledWith(CAT_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await deleteCategory();

    expect(res.status).toBe(403);
    expect(mockDeleteCategory).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockDeleteCategory.mockRejectedValue(new Error('db down'));

    const res = await deleteCategory();

    expect(res.status).toBe(500);
  });
});
