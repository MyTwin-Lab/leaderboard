import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  MockClaimNotFoundError, MockForbiddenClaimAccessError, MockObservationRequiredError,
  mockRevealExpectedOutput,
} = vi.hoisted(() => ({
  MockClaimNotFoundError: class extends Error {},
  MockForbiddenClaimAccessError: class extends Error {},
  MockObservationRequiredError: class extends Error {},
  mockRevealExpectedOutput: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/server/safeFileHeaders', () => ({
  buildSafeFileHeaders: (contentType: string | null, filename: string | null) => ({
    'Content-Type': contentType ?? 'application/octet-stream',
    ...(filename ? { 'Content-Disposition': `inline; filename="${filename}"` } : {}),
  }),
}));

vi.mock('../../../../../../../../../../packages/services/challenge/reference-case.service', () => ({
  ReferenceCaseService: class { revealExpectedOutput = mockRevealExpectedOutput; },
  ClaimNotFoundError: MockClaimNotFoundError,
  ForbiddenClaimAccessError: MockForbiddenClaimAccessError,
  ObservationRequiredError: MockObservationRequiredError,
}));

import { POST } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

function call() {
  const req = new NextRequest('http://localhost/api/challenges/challenge-1/validation-case-claims/claim-1/reveal', {
    method: 'POST',
  });
  return POST(req, { params: Promise.resolve({ id: 'challenge-1', claimId: 'claim-1' }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'medical_pro' });
});

describe('POST /api/challenges/[id]/validation-case-claims/[claimId]/reveal', () => {
  it('returns the expected output bytes on success', async () => {
    mockRevealExpectedOutput.mockResolvedValue({ contentType: 'application/json', filename: null, body: Buffer.from('{"label":"cat"}') });

    const res = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.text()).toBe('{"label":"cat"}');
  });

  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockRevealExpectedOutput).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-medical_pro user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });
    const res = await call();
    expect(res.status).toBe(403);
    expect(mockRevealExpectedOutput).not.toHaveBeenCalled();
  });

  it('maps ClaimNotFoundError to 404', async () => {
    mockRevealExpectedOutput.mockRejectedValue(new MockClaimNotFoundError('no claim'));
    expect((await call()).status).toBe(404);
  });

  it('maps ForbiddenClaimAccessError to 403', async () => {
    mockRevealExpectedOutput.mockRejectedValue(new MockForbiddenClaimAccessError('not yours'));
    expect((await call()).status).toBe(403);
  });

  it('maps ObservationRequiredError to 400 — reveal-before-observation is rejected here too, not just at the service layer', async () => {
    mockRevealExpectedOutput.mockRejectedValue(new MockObservationRequiredError('observe first'));
    expect((await call()).status).toBe(400);
  });
});
