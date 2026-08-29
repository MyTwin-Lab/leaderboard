import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindByChallenge, mockCreate } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeSignalRepository: class {
    findByChallenge = mockFindByChallenge;
    create = mockCreate;
  },
}));

import { GET, POST } from './route';

const CHALLENGE_ID = 'challenge-1';

function getSignals() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/signals`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function postSignal(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('GET /api/challenges/[id]/signals', () => {
  it('returns the signals for the challenge (public, no auth check)', async () => {
    mockFindByChallenge.mockResolvedValue([{ uuid: 's1', label: 'Signal 1' }]);

    const res = await getSignals();

    expect(res.status).toBe(200);
    expect(mockFindByChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(await res.json()).toEqual([{ uuid: 's1', label: 'Signal 1' }]);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await getSignals();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/challenges/[id]/signals', () => {
  const validBody = { label: 'New signal', reward_cp: 5 };

  it('creates a signal for an admin', async () => {
    mockCreate.mockResolvedValue({ uuid: 's1', challenge_id: CHALLENGE_ID, label: 'New signal', reward_cp: 5 });

    const res = await postSignal(validBody);

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID,
      label: 'New signal',
      description: undefined,
      reward_cp: 5,
      icon: null,
      position: 0,
    });
  });

  it('allows a manager of the challenge to create', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockCreate.mockResolvedValue({ uuid: 's1' });

    const res = await postSignal(validBody);

    expect(res.status).toBe(201);
    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith('manager-1', CHALLENGE_ID);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postSignal(validBody);

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin, non-manager', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await postSignal(validBody);

    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body (Zod)', async () => {
    const res = await postSignal({ label: '', reward_cp: 5 });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when reward_cp is missing', async () => {
    const res = await postSignal({ label: 'New signal' });

    expect(res.status).toBe(400);
  });

  it('returns 500 when the repository throws', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postSignal(validBody);

    expect(res.status).toBe(500);
  });
});
