import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockVerifyRequestToken, mockGetSessionUser, mockIsManagerOfChallenge, mockCanAccessChallengeInternals,
  mockGetMeetingsByChallengeId, mockGetAllMeetings, mockCreateMeeting,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockCanAccessChallengeInternals: vi.fn(),
  mockGetMeetingsByChallengeId: vi.fn(),
  mockGetAllMeetings: vi.fn(),
  mockCreateMeeting: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyRequestToken: mockVerifyRequestToken,
  getSessionUser: mockGetSessionUser,
}));
vi.mock('@/lib/server/managerAuth', () => ({
  isManagerOfChallenge: mockIsManagerOfChallenge,
  canAccessChallengeInternals: mockCanAccessChallengeInternals,
}));

vi.mock('../../../../../../packages/database-service/repositories/syncMeeting.repo.js', () => ({
  SyncMeetingRepository: class {},
}));

vi.mock('../../../../../../packages/services/sync-meeting/sync-meeting.service.js', () => ({
  SyncMeetingService: class {
    getMeetingsByChallengeId = mockGetMeetingsByChallengeId;
    getAllMeetings = mockGetAllMeetings;
    createMeeting = mockCreateMeeting;
  },
}));

// Actif par défaut dans ces tests ; le cas désactivé a son describe.
const { mockModuleNotFoundResponse } = vi.hoisted(() => ({ mockModuleNotFoundResponse: vi.fn() }));
vi.mock('@/lib/server/modules', () => ({ moduleNotFoundResponse: mockModuleNotFoundResponse }));

import { GET, POST } from './route';

beforeEach(() => {
  mockModuleNotFoundResponse.mockResolvedValue(null);
});

const CHALLENGE_ID = '11111111-1111-4111-8111-111111111111';
const CONTRIBUTOR = { id: 'u1', role: 'contributor', fullName: 'Ada', githubUsername: '', email: 'a@b.com' };
const ADMIN = { id: 'admin-1', role: 'admin', fullName: 'Root', githubUsername: '', email: 'r@b.com' };

const RAW_MEETING = {
  uuid: 'meeting-1',
  title: 'Sync',
  description: 'Weekly',
  challenge_id: CHALLENGE_ID,
  start_time: '2026-01-01T10:00:00.000Z',
  end_time: '2026-01-01T11:00:00.000Z',
  meet_link: 'https://meet.google.com/abc',
  calendar_event_id: 'cal-1',
  conference_id: 'conf-1',
  conference_record_id: 'rec-1',
  status: 'scheduled',
  created_by: 'manager-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

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
  mockGetSessionUser.mockResolvedValue(CONTRIBUTOR);
  mockIsManagerOfChallenge.mockResolvedValue(true);
  mockCanAccessChallengeInternals.mockResolvedValue(true);
  mockCreateMeeting.mockImplementation(async (data: any) => ({ uuid: 'meeting-1', ...data }));
});

describe('GET /api/sync-meetings', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await getMeetings();
    expect(res.status).toBe(401);
  });

  it('returns 403 to a non-admin asking for every meeting', async () => {
    const res = await getMeetings();

    expect(res.status).toBe(403);
    expect(mockGetAllMeetings).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller cannot access the challenge internals', async () => {
    mockCanAccessChallengeInternals.mockResolvedValue(false);

    const res = await getMeetings(CHALLENGE_ID);

    expect(res.status).toBe(403);
    expect(mockCanAccessChallengeInternals).toHaveBeenCalledWith(CONTRIBUTOR, CHALLENGE_ID);
    expect(mockGetMeetingsByChallengeId).not.toHaveBeenCalled();
  });

  it('returns whitelisted meetings to a member of the challenge', async () => {
    mockGetMeetingsByChallengeId.mockResolvedValue([RAW_MEETING]);

    const res = await getMeetings(CHALLENGE_ID);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetMeetingsByChallengeId).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(body.meetings[0]).toEqual({
      uuid: 'meeting-1',
      title: 'Sync',
      description: 'Weekly',
      challenge_id: CHALLENGE_ID,
      start_time: RAW_MEETING.start_time,
      end_time: RAW_MEETING.end_time,
      meet_link: RAW_MEETING.meet_link,
      status: 'scheduled',
      created_by: 'manager-1',
    });
    expect(mockGetAllMeetings).not.toHaveBeenCalled();
  });

  it('returns every meeting, unfiltered and whole, to an admin', async () => {
    mockGetSessionUser.mockResolvedValue(ADMIN);
    const meetings = [RAW_MEETING, { ...RAW_MEETING, uuid: 'meeting-2' }];
    mockGetAllMeetings.mockResolvedValue(meetings);

    const res = await getMeetings();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meetings });
  });

  it('returns 500 when the service throws', async () => {
    mockGetSessionUser.mockResolvedValue(ADMIN);
    mockGetAllMeetings.mockRejectedValue(new Error('db down'));
    const res = await getMeetings();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch meetings');
  });
});

describe('POST /api/sync-meetings', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
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

  it('does not log the raw request body', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await postMeeting(validBody());
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Raw body'), expect.anything());
    logSpy.mockRestore();
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
    mockGetSessionUser.mockResolvedValue(ADMIN);

    const res = await postMeeting(validBody());

    expect(res.status).toBe(201);
    expect(mockIsManagerOfChallenge).not.toHaveBeenCalled();
  });

  it('trusts the role re-read from the database, not the one in the JWT', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockIsManagerOfChallenge.mockResolvedValue(false);

    const res = await postMeeting(validBody());

    expect(res.status).toBe(403);
  });

  it('returns 500 when the service throws', async () => {
    mockCreateMeeting.mockRejectedValue(new Error('db down'));
    const res = await postMeeting(validBody());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to create meeting');
  });
});

describe('when the meetings module is disabled', () => {
  beforeEach(() => {
    mockModuleNotFoundResponse.mockResolvedValue(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  });

  it('answers 404 to GET and POST, before reading the session', async () => {
    expect((await getMeetings(CHALLENGE_ID)).status).toBe(404);
    expect((await postMeeting(validBody())).status).toBe(404);
    expect(mockModuleNotFoundResponse).toHaveBeenCalledWith('meetings');
    expect(mockGetSessionUser).not.toHaveBeenCalled();
    expect(mockCreateMeeting).not.toHaveBeenCalled();
  });
});
