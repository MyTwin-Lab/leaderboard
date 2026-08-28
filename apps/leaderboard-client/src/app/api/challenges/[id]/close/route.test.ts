import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockUpdate } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockFindById;
    update = mockUpdate;
  },
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';

function postClose() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/close`, { method: 'POST' });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/challenges/[id]/close', () => {
  it('returns 404 for an unknown challenge', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await postClose();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Challenge not found' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('sets the challenge status to completed and returns it', async () => {
    mockFindById.mockResolvedValue({ uuid: CHALLENGE_ID, status: 'active' });
    const closed = { uuid: CHALLENGE_ID, status: 'completed' };
    mockUpdate.mockResolvedValue(closed);

    const res = await postClose();

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(CHALLENGE_ID, { status: 'completed' });
    expect(await res.json()).toEqual({ success: true, challenge: closed });
  });

  it('returns 500 when closing fails', async () => {
    mockFindById.mockResolvedValue({ uuid: CHALLENGE_ID, status: 'active' });
    mockUpdate.mockRejectedValue(new Error('db down'));

    const res = await postClose();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to close challenge' });
  });
});
