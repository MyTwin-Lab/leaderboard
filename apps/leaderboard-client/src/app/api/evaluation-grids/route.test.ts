import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockFindAll, mockCreate } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../packages/database-service/repositories/evaluationGrids.repo.js', () => ({
  EvaluationGridsRepository: class {
    findAll = mockFindAll;
    create = mockCreate;
  },
}));

import { GET, POST } from './route';

function getGrids() {
  return GET(new NextRequest('http://localhost/api/evaluation-grids'));
}

function postGrid(body: unknown) {
  const req = new NextRequest('http://localhost/api/evaluation-grids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/evaluation-grids', () => {
  it('returns 403 when not admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    const res = await getGrids();
    expect(res.status).toBe(403);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('returns the list of grids on success', async () => {
    const grids = [{ uuid: 'g1', slug: 'grid-1', name: 'Grid 1' }];
    mockFindAll.mockResolvedValue(grids);

    const res = await getGrids();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(grids);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindAll.mockRejectedValue(new Error('db down'));
    const res = await getGrids();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/evaluation-grids', () => {
  it('returns 403 when not admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    const res = await postGrid({ slug: 'grid-1', name: 'Grid 1' });
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postGrid({ name: 'Missing slug' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation error');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the grid, injecting created_by from the admin session', async () => {
    mockCreate.mockImplementation(async (data: any) => ({ uuid: 'g1', ...data }));

    const res = await postGrid({ slug: 'grid-1', name: 'Grid 1' });

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'grid-1',
      name: 'Grid 1',
      version: 1,
      status: 'draft',
      created_by: 'admin-1',
    }));
    const body = await res.json();
    expect(body.uuid).toBe('g1');
  });

  it('returns 500 when the repository throws on create', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));
    const res = await postGrid({ slug: 'grid-1', name: 'Grid 1' });
    expect(res.status).toBe(500);
  });
});
