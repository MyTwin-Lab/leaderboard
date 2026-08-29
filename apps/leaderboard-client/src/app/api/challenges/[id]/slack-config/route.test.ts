import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindByChallenge, mockUpsert, mockDelete } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockUpsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeSlackConfigRepository: class {
    findByChallenge = mockFindByChallenge;
    upsert = mockUpsert;
    delete = mockDelete;
  },
}));

import { GET, PUT, DELETE } from './route';

const CHALLENGE_ID = 'challenge-1';

function getConfig() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/slack-config`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function putConfig(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/slack-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function deleteConfig() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/slack-config`, { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('GET /api/challenges/[id]/slack-config', () => {
  it('returns the config for an admin', async () => {
    mockFindByChallenge.mockResolvedValue({ challenge_id: CHALLENGE_ID, channel_id: 'C123' });

    const res = await getConfig();

    expect(res.status).toBe(200);
    expect(mockFindByChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(await res.json()).toEqual({ challenge_id: CHALLENGE_ID, channel_id: 'C123' });
  });

  it('allows a manager of the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockFindByChallenge.mockResolvedValue(null);

    const res = await getConfig();

    expect(res.status).toBe(200);
    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith('manager-1', CHALLENGE_ID);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await getConfig();

    expect(res.status).toBe(401);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin, non-manager', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await getConfig();

    expect(res.status).toBe(403);
    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByChallenge.mockRejectedValue(new Error('db down'));

    const res = await getConfig();

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/challenges/[id]/slack-config', () => {
  const validBody = { channel_id: 'C123', channel_name: 'general' };

  it('upserts the config for an admin', async () => {
    mockUpsert.mockResolvedValue({ challenge_id: CHALLENGE_ID, channel_id: 'C123', channel_name: 'general' });

    const res = await putConfig(validBody);

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID,
      channel_id: 'C123',
      channel_name: 'general',
    });
  });

  it('defaults channel_name to null when omitted', async () => {
    mockUpsert.mockResolvedValue({ challenge_id: CHALLENGE_ID, channel_id: 'C123', channel_name: null });

    await putConfig({ channel_id: 'C123' });

    expect(mockUpsert).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID,
      channel_id: 'C123',
      channel_name: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await putConfig(validBody);

    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin, non-manager', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await putConfig(validBody);

    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body (Zod)', async () => {
    const res = await putConfig({ channel_id: '' });

    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockUpsert.mockRejectedValue(new Error('db down'));

    const res = await putConfig(validBody);

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/challenges/[id]/slack-config', () => {
  it('deletes the config for an admin', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await deleteConfig();

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await deleteConfig();

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin, non-manager', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await deleteConfig();

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockDelete.mockRejectedValue(new Error('db down'));

    const res = await deleteConfig();

    expect(res.status).toBe(500);
  });
});
