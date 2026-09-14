import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindInputById, mockIsManagerOfChallenge } = vi.hoisted(() => ({
  mockFindInputById: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));
vi.mock('../../../../../../../../../../packages/database-service/repositories', () => ({
  ReferenceCaseRepository: class { findInputById = mockFindInputById; },
}));

import { GET } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

function call() {
  const req = new NextRequest('http://localhost/api/challenges/challenge-1/validation-reference-cases/case-1/input');
  return GET(req, { params: Promise.resolve({ id: 'challenge-1', caseId: 'case-1' }) });
}

const CASE = {
  uuid: 'case-1',
  validation_challenge_id: 'challenge-1',
  author_user_id: 'alice',
  input_bytes: Buffer.from('<svg onload=alert(1)>'),
  input_filename: 'x.svg',
  input_content_type: 'image/svg+xml',
  purged_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'alice', role: 'medical_pro' });
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockFindInputById.mockResolvedValue(CASE);
});

describe('GET /api/challenges/[id]/validation-reference-cases/[caseId]/input', () => {
  it("sert les octets de l'auteur avec nosniff", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toBe('<svg onload=alert(1)>');
  });

  it('renvoie 410 une fois la purge de conservation passée', async () => {
    mockFindInputById.mockResolvedValue({ ...CASE, input_bytes: Buffer.alloc(0), purged_at: new Date() });
    const res = await call();
    expect(res.status).toBe(410);
  });

  it("garde le 403 avant le 410 : la purge ne dit rien à qui n'a pas accès", async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'mallory', role: 'contributor' });
    mockFindInputById.mockResolvedValue({ ...CASE, purged_at: new Date() });
    const res = await call();
    expect(res.status).toBe(403);
  });
});
