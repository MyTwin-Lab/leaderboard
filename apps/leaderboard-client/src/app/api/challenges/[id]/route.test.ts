import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyRequestToken, mockIsManagerOfChallenge, mockChallengeFindById, mockChallengeUpdate, mockPurgeContentForChallenge } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockChallengeUpdate: vi.fn(),
  mockPurgeContentForChallenge: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
    update = mockChallengeUpdate;
  },
  ValidationAttemptRepository: class {
    purgeContentForChallenge = mockPurgeContentForChallenge;
  },
}));

import { PUT } from './route';

const CHALLENGE_ID = 'challenge-1';

function putStatus(status: string) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockChallengeUpdate.mockImplementation(async (_id: string, data: any) => ({ uuid: CHALLENGE_ID, ...data }));
  mockPurgeContentForChallenge.mockResolvedValue(undefined);
});

describe('PUT /api/challenges/[id] — archive-triggered purge of validation runs', () => {
  it('purges validation attempt blobs when a validation challenge transitions to archived', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'active' });

    const res = await putStatus('archived');

    expect(res.status).toBe(200);
    expect(mockPurgeContentForChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it('does not purge when the challenge is already archived (no transition)', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'archived' });

    await putStatus('archived');

    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });

  it('does not purge for a non-validation challenge being archived', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml', status: 'active' });

    await putStatus('archived');

    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });

  it('does not purge on a status change that is not "archived"', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'draft' });

    await putStatus('active');

    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });

  it('still returns the updated challenge even if the purge itself fails (best-effort)', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', status: 'active' });
    mockPurgeContentForChallenge.mockRejectedValue(new Error('db down'));

    const res = await putStatus('archived');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uuid).toBe(CHALLENGE_ID);
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await putStatus('archived');
    expect(res.status).toBe(401);
    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage this challenge', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    mockIsManagerOfChallenge.mockResolvedValue(false);
    const res = await putStatus('archived');
    expect(res.status).toBe(403);
    expect(mockPurgeContentForChallenge).not.toHaveBeenCalled();
  });
});
