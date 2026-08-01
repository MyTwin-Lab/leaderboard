import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockChallengeFindById, mockAttemptFindById } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockAttemptFindById: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockChallengeFindById; },
  ValidationAttemptRepository: class { findById = mockAttemptFindById; },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';
const ATTEMPT_ID = 'attempt-1';

function callGet() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-runs/${ATTEMPT_ID}/response`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID, attemptId: ATTEMPT_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation' });
});

describe('GET /api/challenges/[id]/validation-runs/[attemptId]/response', () => {
  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await callGet()).status).toBe(401);
  });

  it('returns 403 for a non-admin, non-manager user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);
    expect((await callGet()).status).toBe(403);
  });

  it('returns 404 when the run belongs to a different challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({ validation_challenge_id: 'other-challenge', response_bytes: Buffer.from('x') });
    expect((await callGet()).status).toBe(404);
  });

  it('returns 410 when the response was purged (response_bytes is null)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({ validation_challenge_id: CHALLENGE_ID, response_bytes: null });
    expect((await callGet()).status).toBe(410);
  });

  it('streams the response bytes with hardened headers and echoes the original HTTP status', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID,
      response_bytes: Buffer.from('{"label":"cat"}'),
      response_content_type: 'application/json',
      response_status: 500,
    });

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    // JSON is not in the raster-image allowlist, so it must never render inline.
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-validation-status')).toBe('500');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('{"label":"cat"}');
  });

  it('omits X-Validation-Status when response_status is null', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID,
      response_bytes: Buffer.from('hi'),
      response_content_type: 'text/plain',
      response_status: null,
    });

    const res = await callGet();

    expect(res.headers.get('x-validation-status')).toBeNull();
  });

  it('never renders a validated endpoint response inline, even if it claims to be an image/svg+xml', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID,
      response_bytes: Buffer.from('<svg onload="alert(1)"></svg>'),
      response_content_type: 'image/svg+xml',
      response_status: 200,
    });

    const res = await callGet();

    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
  });
});
