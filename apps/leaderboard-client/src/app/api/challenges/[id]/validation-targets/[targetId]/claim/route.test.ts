import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  MockValidationTargetError, MockSelfVoteError, MockInsufficientRoleError,
  MockSelfAuthoredCaseError, MockDuplicateClaimError, MockEndpointCallError,
  mockClaimCase, mockFindById,
} = vi.hoisted(() => {
  return {
    MockValidationTargetError: class extends Error {},
    MockSelfVoteError: class extends Error {},
    MockInsufficientRoleError: class extends Error {},
    MockSelfAuthoredCaseError: class extends Error {},
    MockDuplicateClaimError: class extends Error {},
    MockEndpointCallError: class extends Error {},
    mockClaimCase: vi.fn(),
    mockFindById: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));

vi.mock('../../../../../../../../../../packages/services/challenge/reference-case.service', () => ({
  ReferenceCaseService: class { claimCase = mockClaimCase; },
  ValidationTargetError: MockValidationTargetError,
  SelfVoteError: MockSelfVoteError,
  InsufficientRoleError: MockInsufficientRoleError,
  SelfAuthoredCaseError: MockSelfAuthoredCaseError,
  DuplicateClaimError: MockDuplicateClaimError,
  EndpointCallError: MockEndpointCallError,
}));

vi.mock('../../../../../../../../../../packages/database-service/repositories', () => ({
  ValidationTargetRepository: class { findById = mockFindById; },
}));

import { POST } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/challenges/challenge-1/validation-targets/target-1/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const CASE_ID = '33333333-3333-4333-8333-333333333333';

function call(body: Record<string, unknown> = { reference_case_id: CASE_ID }) {
  return POST(buildRequest(body), { params: Promise.resolve({ id: 'challenge-1', targetId: 'target-1' }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'medical_pro' });
  mockFindById.mockResolvedValue({ uuid: 'target-1', validation_challenge_id: 'challenge-1', contribution_id: 'contrib-1' });
});

describe('POST /api/challenges/[id]/validation-targets/[targetId]/claim', () => {
  it('returns the live response bytes with a claim id header on success', async () => {
    mockClaimCase.mockResolvedValue({
      claim: { uuid: 'claim-1' },
      liveResponse: { status: 200, contentType: 'application/json', body: Buffer.from('{"label":"cat"}') },
    });

    const res = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get('x-claim-id')).toBe('claim-1');
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = await res.text();
    expect(body).toBe('{"label":"cat"}');
  });

  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockClaimCase).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-medical_pro user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });
    const res = await call();
    expect(res.status).toBe(403);
    expect(mockClaimCase).not.toHaveBeenCalled();
  });

  it('returns 404 when the target does not belong to this challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: 'target-1', validation_challenge_id: 'other-challenge', contribution_id: 'contrib-1' });
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockClaimCase).not.toHaveBeenCalled();
  });

  it('maps InsufficientRoleError to 403', async () => {
    mockClaimCase.mockRejectedValue(new MockInsufficientRoleError('nope'));
    expect((await call()).status).toBe(403);
  });

  it('maps SelfAuthoredCaseError to 403', async () => {
    mockClaimCase.mockRejectedValue(new MockSelfAuthoredCaseError('own case'));
    expect((await call()).status).toBe(403);
  });

  it('maps SelfVoteError to 403', async () => {
    mockClaimCase.mockRejectedValue(new MockSelfVoteError('own submission'));
    expect((await call()).status).toBe(403);
  });

  it('maps ValidationTargetError to 400', async () => {
    mockClaimCase.mockRejectedValue(new MockValidationTargetError('bad target'));
    expect((await call()).status).toBe(400);
  });

  it('maps DuplicateClaimError to 409 — the concurrent-claim race from the SPEC', async () => {
    mockClaimCase.mockRejectedValue(new MockDuplicateClaimError('already claimed'));
    const res = await call();
    expect(res.status).toBe(409);
  });

  it('maps EndpointCallError to 502', async () => {
    mockClaimCase.mockRejectedValue(new MockEndpointCallError('unreachable'));
    expect((await call()).status).toBe(502);
  });

  it('returns 400 for an invalid reference_case_id', async () => {
    const res = await call({ reference_case_id: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(mockClaimCase).not.toHaveBeenCalled();
  });
});
