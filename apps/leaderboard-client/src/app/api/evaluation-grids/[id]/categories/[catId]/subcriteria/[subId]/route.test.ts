import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockUpdateSubcriterion, mockDeleteSubcriterion } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockUpdateSubcriterion: vi.fn(),
  mockDeleteSubcriterion: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js', () => ({
  EvaluationGridsRepository: class {
    updateSubcriterion = mockUpdateSubcriterion;
    deleteSubcriterion = mockDeleteSubcriterion;
  },
}));

import { PUT, DELETE } from './route';

const GRID_ID = 'grid-1';
const CAT_ID = 'cat-1';
const SUB_ID = 'sub-1';

function putSubcriterion(body: unknown) {
  const req = new NextRequest(
    `http://localhost/api/evaluation-grids/${GRID_ID}/categories/${CAT_ID}/subcriteria/${SUB_ID}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return PUT(req, { params: Promise.resolve({ id: GRID_ID, catId: CAT_ID, subId: SUB_ID }) });
}

function deleteSubcriterion() {
  const req = new NextRequest(
    `http://localhost/api/evaluation-grids/${GRID_ID}/categories/${CAT_ID}/subcriteria/${SUB_ID}`,
    { method: 'DELETE' }
  );
  return DELETE(req, { params: Promise.resolve({ id: GRID_ID, catId: CAT_ID, subId: SUB_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('PUT /api/evaluation-grids/[id]/categories/[catId]/subcriteria/[subId]', () => {
  it('updates the subcriterion and returns it', async () => {
    const updated = { uuid: SUB_ID, criterion: 'Updated criterion', weight: 0.3 };
    mockUpdateSubcriterion.mockResolvedValue(updated);

    const res = await putSubcriterion({ criterion: 'Updated criterion', weight: 0.3 });

    expect(res.status).toBe(200);
    expect(mockUpdateSubcriterion).toHaveBeenCalledWith(SUB_ID, { criterion: 'Updated criterion', weight: 0.3 });
    expect(await res.json()).toEqual(updated);
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await putSubcriterion({ criterion: 'x' });

    expect(res.status).toBe(403);
    expect(mockUpdateSubcriterion).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body (Zod)', async () => {
    const res = await putSubcriterion({ weight: 5 });

    expect(res.status).toBe(400);
    expect(mockUpdateSubcriterion).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockUpdateSubcriterion.mockRejectedValue(new Error('db down'));

    const res = await putSubcriterion({ criterion: 'x' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/evaluation-grids/[id]/categories/[catId]/subcriteria/[subId]', () => {
  it('deletes the subcriterion', async () => {
    mockDeleteSubcriterion.mockResolvedValue(true);

    const res = await deleteSubcriterion();

    expect(res.status).toBe(200);
    expect(mockDeleteSubcriterion).toHaveBeenCalledWith(SUB_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await deleteSubcriterion();

    expect(res.status).toBe(403);
    expect(mockDeleteSubcriterion).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockDeleteSubcriterion.mockRejectedValue(new Error('db down'));

    const res = await deleteSubcriterion();

    expect(res.status).toBe(500);
  });
});
