import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindById, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeSignalRepository: class {
    findById = mockFindById;
    update = mockUpdate;
    delete = mockDelete;
  },
}));

import { PUT, DELETE } from './route';

const CHALLENGE_ID = 'challenge-1';
const SIGNAL_ID = 'signal-1';

function putSignal(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/signals/${SIGNAL_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID, signalId: SIGNAL_ID }) });
}

function deleteSignal() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/signals/${SIGNAL_ID}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID, signalId: SIGNAL_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockFindById.mockResolvedValue({ uuid: SIGNAL_ID, challenge_id: CHALLENGE_ID, label: 'Old label' });
});

describe('PUT /api/challenges/[id]/signals/[signalId]', () => {
  it('updates the signal for an admin', async () => {
    mockUpdate.mockResolvedValue({ uuid: SIGNAL_ID, challenge_id: CHALLENGE_ID, label: 'New label' });

    const res = await putSignal({ label: 'New label' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(SIGNAL_ID, { label: 'New label' });
    const body = await res.json();
    expect(body.label).toBe('New label');
  });

  it('allows a manager of the challenge to update', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockUpdate.mockResolvedValue({ uuid: SIGNAL_ID });

    const res = await putSignal({ label: 'New label' });

    expect(res.status).toBe(200);
    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith('manager-1', CHALLENGE_ID);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await putSignal({ label: 'New label' });

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin, non-manager', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await putSignal({ label: 'New label' });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the signal does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await putSignal({ label: 'New label' });

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the signal belongs to a different challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: SIGNAL_ID, challenge_id: 'other-challenge' });

    const res = await putSignal({ label: 'New label' });

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body (Zod)', async () => {
    const res = await putSignal({ reward_cp: -1 });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));

    const res = await putSignal({ label: 'New label' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/challenges/[id]/signals/[signalId]', () => {
  it('deletes the signal for an admin', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteSignal();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(SIGNAL_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await deleteSignal();

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin, non-manager', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await deleteSignal();

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when the signal does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await deleteSignal();

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when the signal belongs to a different challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: SIGNAL_ID, challenge_id: 'other-challenge' });

    const res = await deleteSignal();

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteSignal();

    expect(res.status).toBe(500);
  });
});
