import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  MockInsufficientRoleError, MockReferenceCaseQuotaError, MockValidationTargetError,
  mockAuthorCase, mockFindByChallenge, mockFindByAuthor, mockIsManagerOfChallenge,
} = vi.hoisted(() => ({
  MockInsufficientRoleError: class extends Error {},
  MockReferenceCaseQuotaError: class extends Error {},
  MockValidationTargetError: class extends Error {},
  mockAuthorCase: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockFindByAuthor: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../packages/services/challenge/reference-case.service', () => ({
  ReferenceCaseService: class { authorCase = mockAuthorCase; },
  InsufficientRoleError: MockInsufficientRoleError,
  ReferenceCaseQuotaError: MockReferenceCaseQuotaError,
  ValidationTargetError: MockValidationTargetError,
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ReferenceCaseRepository: class {
    findByChallenge = mockFindByChallenge;
    findByAuthor = mockFindByAuthor;
  },
}));

import { GET, POST } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

function get() {
  const req = new NextRequest('http://localhost/api/challenges/challenge-1/validation-reference-cases');
  return GET(req, { params: Promise.resolve({ id: 'challenge-1' }) });
}

function post(fields: Record<string, string | Blob> = {}) {
  const form = new FormData();
  form.append('input', new File([Buffer.from('in')], 'in.png', { type: 'image/png' }));
  form.append('expected_output', new File([Buffer.from('out')], 'out.txt', { type: 'text/plain' }));
  for (const [k, v] of Object.entries(fields)) form.set(k, v as any);
  const req = new NextRequest('http://localhost/api/challenges/challenge-1/validation-reference-cases', {
    method: 'POST',
    body: form,
  });
  return POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'medical_pro' });
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockFindByChallenge.mockResolvedValue([]);
  mockFindByAuthor.mockResolvedValue([]);
});

describe('POST /api/challenges/[id]/validation-reference-cases', () => {
  it('authors a case as medical_pro', async () => {
    mockAuthorCase.mockResolvedValue({
      uuid: 'case-1', author_user_id: 'bob', input_filename: 'in.png', input_content_type: 'image/png', created_at: new Date(),
    });

    const res = await post();

    expect(res.status).toBe(201);
    expect(mockAuthorCase).toHaveBeenCalledTimes(1);
    expect(mockAuthorCase.mock.calls[0][0].authorUserId).toBe('bob');
  });

  it('returns 403 for a contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    const res = await post();
    expect(res.status).toBe(403);
    expect(mockAuthorCase).not.toHaveBeenCalled();
  });

  it('returns 403 for an admin — no authoring override exists', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    const res = await post();
    expect(res.status).toBe(403);
    expect(mockAuthorCase).not.toHaveBeenCalled();
  });

  it('maps ReferenceCaseQuotaError to 409', async () => {
    mockAuthorCase.mockRejectedValue(new MockReferenceCaseQuotaError('quota reached'));
    const res = await post();
    expect(res.status).toBe(409);
  });

  it('maps ValidationTargetError to 400', async () => {
    mockAuthorCase.mockRejectedValue(new MockValidationTargetError('not a validation challenge'));
    const res = await post();
    expect(res.status).toBe(400);
  });

  it('returns 400 when the input file is missing', async () => {
    const form = new FormData();
    form.append('expected_output', new File([Buffer.from('out')], 'out.txt', { type: 'text/plain' }));
    const req = new NextRequest('http://localhost/api/challenges/challenge-1/validation-reference-cases', { method: 'POST', body: form });
    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/challenges/[id]/validation-reference-cases', () => {
  it('returns the full list for an admin', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockFindByChallenge.mockResolvedValue([{ uuid: 'case-1', author_user_id: 'bob', input_filename: 'a.png', input_content_type: 'image/png', created_at: new Date() }]);

    const res = await get();

    expect(res.status).toBe(200);
    expect(mockFindByChallenge).toHaveBeenCalledWith('challenge-1');
    const body = await res.json();
    expect(body.cases).toHaveLength(1);
  });

  it('returns the full list for a manager', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'mgr-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    const res = await get();

    expect(res.status).toBe(200);
    expect(mockFindByChallenge).toHaveBeenCalled();
  });

  it("returns only the caller's own cases for a medical_pro", async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(mockFindByAuthor).toHaveBeenCalledWith('challenge-1', 'bob');
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('returns 403 for a plain contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    const res = await get();
    expect(res.status).toBe(403);
  });
});
