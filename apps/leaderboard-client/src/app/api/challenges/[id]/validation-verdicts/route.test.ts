import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  MockSelfVoteError, MockDuplicateVerdictError, MockValidationTargetError,
  MockInsufficientRoleError, MockClaimNotFoundError, MockForbiddenClaimAccessError, MockClaimNotRevealedError,
  mockCastVerdict,
} = vi.hoisted(() => {
  return {
    MockSelfVoteError: class extends Error {},
    MockDuplicateVerdictError: class extends Error {},
    MockValidationTargetError: class extends Error {},
    MockInsufficientRoleError: class extends Error {},
    MockClaimNotFoundError: class extends Error {},
    MockForbiddenClaimAccessError: class extends Error {},
    MockClaimNotRevealedError: class extends Error {},
    mockCastVerdict: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('../../../../../../../../packages/services/challenge/validation-challenge.service', () => ({
  ValidationChallengeService: class {
    castVerdict = mockCastVerdict;
  },
  SelfVoteError: MockSelfVoteError,
  DuplicateVerdictError: MockDuplicateVerdictError,
  ValidationTargetError: MockValidationTargetError,
  InsufficientRoleError: MockInsufficientRoleError,
  ClaimNotFoundError: MockClaimNotFoundError,
  ForbiddenClaimAccessError: MockForbiddenClaimAccessError,
  ClaimNotRevealedError: MockClaimNotRevealedError,
}));

import { POST } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

const CLAIM_ID = '22222222-2222-4222-8222-222222222222';

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/challenges/challenge-1/validation-verdicts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    contribution_id: '11111111-1111-4111-8111-111111111111',
    verdict: 'works',
    description: 'Looks correct on the sample input',
    reference_case_claim_id: CLAIM_ID,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'medical_pro' });
});

describe('POST /api/challenges/[id]/validation-verdicts', () => {
  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(401);
    expect(mockCastVerdict).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-medical_pro user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(403);
    expect(mockCastVerdict).not.toHaveBeenCalled();
  });

  it('forwards the verdict, description, and claim id to the service', async () => {
    mockCastVerdict.mockResolvedValue({ verdictRecorded: true, resolved: false, outcome: 'pending', verdictCount: 1, requiredValidations: 3, cpAwarded: 0 });

    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(200);
    expect(mockCastVerdict).toHaveBeenCalledWith({
      validationChallengeId: 'challenge-1',
      contributionId: '11111111-1111-4111-8111-111111111111',
      validatorUserId: 'user-1',
      verdict: 'works',
      description: 'Looks correct on the sample input',
      referenceCaseClaimId: CLAIM_ID,
    });
  });

  it('rejects a "works" verdict with no description', async () => {
    const res = await POST(buildRequest(baseBody({ description: '' })), { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(400);
    expect(mockCastVerdict).not.toHaveBeenCalled();
  });

  it('rejects a "broken" verdict with no description', async () => {
    const res = await POST(buildRequest(baseBody({ verdict: 'broken', description: '' })), { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(400);
    expect(mockCastVerdict).not.toHaveBeenCalled();
  });

  it('rejects an invalid contribution_id', async () => {
    const res = await POST(buildRequest(baseBody({ contribution_id: 'not-a-uuid' })), { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(400);
  });

  it('rejects a missing reference_case_claim_id', async () => {
    const body = baseBody();
    delete (body as any).reference_case_claim_id;

    const res = await POST(buildRequest(body), { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(400);
  });

  it('maps InsufficientRoleError to 403', async () => {
    mockCastVerdict.mockRejectedValue(new MockInsufficientRoleError('nope'));
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(403);
  });

  it('maps SelfVoteError to 403', async () => {
    mockCastVerdict.mockRejectedValue(new MockSelfVoteError('nope'));
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(403);
  });

  it('maps DuplicateVerdictError to 409', async () => {
    mockCastVerdict.mockRejectedValue(new MockDuplicateVerdictError('already voted'));
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(409);
  });

  it('maps ValidationTargetError to 400', async () => {
    mockCastVerdict.mockRejectedValue(new MockValidationTargetError('not exposed'));
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(400);
  });

  it('maps ClaimNotFoundError to 404', async () => {
    mockCastVerdict.mockRejectedValue(new MockClaimNotFoundError('no claim'));
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(404);
  });

  it('maps ForbiddenClaimAccessError to 403', async () => {
    mockCastVerdict.mockRejectedValue(new MockForbiddenClaimAccessError('not yours'));
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(403);
  });

  it('maps ClaimNotRevealedError to 400', async () => {
    mockCastVerdict.mockRejectedValue(new MockClaimNotRevealedError('not revealed'));
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(400);
  });

  it('maps an unknown error to 500', async () => {
    mockCastVerdict.mockRejectedValue(new Error('boom'));
    const res = await POST(buildRequest(baseBody()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(500);
  });
});
