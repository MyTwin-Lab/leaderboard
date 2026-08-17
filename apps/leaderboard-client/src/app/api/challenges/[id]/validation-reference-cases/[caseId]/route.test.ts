import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindInputById, mockFindByReferenceCase, mockDelete } = vi.hoisted(() => ({
  mockFindInputById: vi.fn(),
  mockFindByReferenceCase: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ReferenceCaseRepository: class {
    findInputById = mockFindInputById;
    delete = mockDelete;
  },
  CaseClaimRepository: class {
    findByReferenceCase = mockFindByReferenceCase;
  },
}));

import { DELETE } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

function call() {
  const req = new NextRequest('http://localhost/api/challenges/challenge-1/validation-reference-cases/case-1', { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: 'challenge-1', caseId: 'case-1' }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'medical_pro' });
  mockFindInputById.mockResolvedValue({ uuid: 'case-1', validation_challenge_id: 'challenge-1', author_user_id: 'bob' });
  mockFindByReferenceCase.mockResolvedValue([]);
  mockDelete.mockResolvedValue(undefined);
});

describe('DELETE /api/challenges/[id]/validation-reference-cases/[caseId]', () => {
  it('lets the author remove their own unclaimed case', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('case-1');
  });

  it('lets an admin remove any unclaimed case', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockFindInputById.mockResolvedValue({ uuid: 'case-1', validation_challenge_id: 'challenge-1', author_user_id: 'someone-else' });

    const res = await call();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('case-1');
  });

  it('returns 403 for a different medical_pro who is not the author', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'other-medical-pro', role: 'medical_pro' });

    const res = await call();

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 409 once the case already has a claim', async () => {
    mockFindByReferenceCase.mockResolvedValue([{ uuid: 'claim-1' }]);

    const res = await call();

    expect(res.status).toBe(409);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when the case does not belong to this challenge', async () => {
    mockFindInputById.mockResolvedValue({ uuid: 'case-1', validation_challenge_id: 'other-challenge', author_user_id: 'bob' });

    const res = await call();

    expect(res.status).toBe(404);
  });
});
