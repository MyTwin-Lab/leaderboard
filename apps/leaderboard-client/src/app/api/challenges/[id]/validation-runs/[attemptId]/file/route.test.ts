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
  CaseClaimRepository: class { findById = vi.fn(); },
  ReferenceCaseRepository: class { findInputById = vi.fn(); },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';
const ATTEMPT_ID = 'attempt-1';

function callGet() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-runs/${ATTEMPT_ID}/file`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID, attemptId: ATTEMPT_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation' });
});

describe('GET /api/challenges/[id]/validation-runs/[attemptId]/file', () => {
  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await callGet()).status).toBe(401);
  });

  it('returns 403 for a non-admin, non-manager user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);
    expect((await callGet()).status).toBe(403);
  });

  it('returns 400 when the challenge is not a validation challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml' });
    expect((await callGet()).status).toBe(400);
  });

  it('returns 404 when the run does not exist', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue(null);
    expect((await callGet()).status).toBe(404);
  });

  it('returns 404 when the run belongs to a different challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({ validation_challenge_id: 'other-challenge', file_bytes: Buffer.from('x') });
    expect((await callGet()).status).toBe(404);
  });

  it('returns 410 when the file was purged (file_bytes is null)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({ validation_challenge_id: CHALLENGE_ID, file_bytes: null });
    expect((await callGet()).status).toBe(410);
  });

  it('streams the file bytes with hardened headers — inline for an allowlisted image', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID,
      file_bytes: Buffer.from('fake-png-bytes'),
      file_content_type: 'image/png',
      file_filename: 'cat.png',
    });

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-disposition')).toMatch(/^inline;/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('fake-png-bytes');
  });

  it('forces attachment for a non-allowlisted content type (e.g. an uploaded HTML file)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockAttemptFindById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID,
      file_bytes: Buffer.from('<script>alert(1)</script>'),
      file_content_type: 'text/html',
      file_filename: 'exploit.html',
    });

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
  });

  it('allows a manager of the challenge (not just admins)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockAttemptFindById.mockResolvedValue({
      validation_challenge_id: CHALLENGE_ID,
      file_bytes: Buffer.from('x'),
      file_content_type: 'image/png',
      file_filename: 'x.png',
    });
    expect((await callGet()).status).toBe(200);
  });
});
