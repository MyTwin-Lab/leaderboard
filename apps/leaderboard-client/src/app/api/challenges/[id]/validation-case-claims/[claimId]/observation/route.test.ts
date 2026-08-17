import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  MockClaimNotFoundError, MockForbiddenClaimAccessError, MockObservationAlreadyRecordedError,
  mockRecordObservation,
} = vi.hoisted(() => ({
  MockClaimNotFoundError: class extends Error {},
  MockForbiddenClaimAccessError: class extends Error {},
  MockObservationAlreadyRecordedError: class extends Error {},
  mockRecordObservation: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));

vi.mock('../../../../../../../../../../packages/services/challenge/reference-case.service', () => ({
  ReferenceCaseService: class { recordObservation = mockRecordObservation; },
  ClaimNotFoundError: MockClaimNotFoundError,
  ForbiddenClaimAccessError: MockForbiddenClaimAccessError,
  ObservationAlreadyRecordedError: MockObservationAlreadyRecordedError,
}));

import { POST } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

function call(body: Record<string, unknown> = { observation: 'Looks correct' }) {
  const req = new NextRequest('http://localhost/api/challenges/challenge-1/validation-case-claims/claim-1/observation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: 'challenge-1', claimId: 'claim-1' }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'medical_pro' });
});

describe('POST /api/challenges/[id]/validation-case-claims/[claimId]/observation', () => {
  it('records the observation on success', async () => {
    mockRecordObservation.mockResolvedValue({ uuid: 'claim-1', observed_at: new Date() });

    const res = await call();

    expect(res.status).toBe(200);
    expect(mockRecordObservation).toHaveBeenCalledWith({ claimId: 'claim-1', validatorUserId: 'bob', observation: 'Looks correct' });
  });

  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockRecordObservation).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-medical_pro user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });
    const res = await call();
    expect(res.status).toBe(403);
    expect(mockRecordObservation).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty observation', async () => {
    const res = await call({ observation: '' });
    expect(res.status).toBe(400);
    expect(mockRecordObservation).not.toHaveBeenCalled();
  });

  it('maps ClaimNotFoundError to 404', async () => {
    mockRecordObservation.mockRejectedValue(new MockClaimNotFoundError('no claim'));
    expect((await call()).status).toBe(404);
  });

  it('maps ForbiddenClaimAccessError to 403', async () => {
    mockRecordObservation.mockRejectedValue(new MockForbiddenClaimAccessError('not yours'));
    expect((await call()).status).toBe(403);
  });

  it('maps ObservationAlreadyRecordedError to 409', async () => {
    mockRecordObservation.mockRejectedValue(new MockObservationAlreadyRecordedError('already recorded'));
    expect((await call()).status).toBe(409);
  });
});
