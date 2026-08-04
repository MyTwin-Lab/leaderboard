import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken, mockIsManagerOfChallenge, mockGetMeetingsByChallengeId,
  mockGetAllMeetings, mockCreateMeeting,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockGetMeetingsByChallengeId: vi.fn(),
  mockGetAllMeetings: vi.fn(),
  mockCreateMeeting: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../packages/services/sync-meeting/sync-meeting.service.js', () => ({
  SyncMeetingService: class {
    getMeetingsByChallengeId = mockGetMeetingsByChallengeId;
    getAllMeetings = mockGetAllMeetings;
    createMeeting = mockCreateMeeting;
  },
}));

import { GET, POST } from './route';

const CHALLENGE_ID = '11111111-1111-4111-8111-111111111111';

function getMeetings(challengeId?: string) {
  const url = challengeId
    ? `http://localhost/api/sync-meetings?challenge_id=${challengeId}`
    : 'http://localhost/api/sync-meetings';
  return GET(new NextRequest(url));
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Sprint planning',
    challenge_id: CHALLENGE_ID,
    start_time: '2026-01-01T10:00:00.000Z',
    end_time: '2026-01-01T11:00:00.000Z',
    ...overrides,
  };
}

function postMeeting(body: unknown) {
  const req = new NextRequest('http://localhost/api/sync-meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
  mockIsManagerOfChallenge.mockResolvedValue(true);
  mockCreateMeeting.mockImplementation(async (data: any) => ({ uuid: 'meeting-1', ...data }));
});

describe('GET /api/sync-meetings', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await getMeetings();
    expect(res.status).toBe(401);
  });

  it('returns meetings scoped to challenge_id when provided', async () => {
    const meetings = [{ uuid: 'meeting-1' }];
    mockGetMeetingsByChallengeId.mockResolvedValue(meetings);

    const res = await getMeetings(CHALLENGE_ID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meetings });
    expect(mockGetMeetingsByChallengeId).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(mockGetAllMeetings).not.toHaveBeenCalled();
  });

  it('returns all meetings when no challenge_id is provided', async () => {
    const meetings = [{ uuid: 'meeting-1' }, { uuid: 'meeting-2' }];
    mockGetAllMeetings.mockResolvedValue(meetings);

    const res = await getMeetings();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meetings });
  });

  it('returns 500 when the service throws', async () => {
    mockGetAllMeetings.mockRejectedValue(new Error('db down'));
    const res = await getMeetings();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch meetings');
  });
});

describe('POST /api/sync-meetings', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await postMeeting(validBody());
    expect(res.status).toBe(401);
    expect(mockCreateMeeting).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postMeeting(validBody({ title: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation error');
    expect(mockCreateMeeting).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is neither admin nor manager of the challenge', async () => {
    mockIsManagerOfChallenge.mockResolvedValue(false);
    const res = await postMeeting(validBody());
    expect(res.status).toBe(403);
    expect(mockCreateMeeting).not.toHaveBeenCalled();
  });

  it('creates the meeting when the caller manages the challenge', async () => {
    const res = await postMeeting(validBody());

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.meeting.uuid).toBe('meeting-1');
    expect(mockCreateMeeting).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Sprint planning',
      challenge_id: CHALLENGE_ID,
      created_by: 'u1',
    }));
  });

  it('creates the meeting for an admin without checking manager status', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });

    const res = await postMeeting(validBody());

    expect(res.status).toBe(201);
    expect(mockIsManagerOfChallenge).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws', async () => {
    mockCreateMeeting.mockRejectedValue(new Error('db down'));
    const res = await postMeeting(validBody());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to create meeting');
  });
});
