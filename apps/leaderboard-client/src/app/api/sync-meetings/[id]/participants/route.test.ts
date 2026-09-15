import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockGetSessionUser, mockCanAccessChallengeInternals, mockMeetingFindById, mockFindByMeetingId,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockCanAccessChallengeInternals: vi.fn(),
  mockMeetingFindById: vi.fn(),
  mockFindByMeetingId: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({
  canAccessChallengeInternals: mockCanAccessChallengeInternals,
}));

vi.mock('../../../../../../../../packages/database-service/repositories/syncMeeting.repo.js', () => ({
  SyncMeetingRepository: class {
    findById = mockMeetingFindById;
  },
}));

vi.mock('../../../../../../../../packages/database-service/repositories/meetingParticipant.repo.js', () => ({
  MeetingParticipantRepository: class {
    findByMeetingId = mockFindByMeetingId;
  },
}));

// Actif par défaut dans ces tests ; le cas désactivé a son describe.
const { mockModuleNotFoundResponse } = vi.hoisted(() => ({ mockModuleNotFoundResponse: vi.fn() }));
vi.mock('@/lib/server/modules', () => ({ moduleNotFoundResponse: mockModuleNotFoundResponse }));

import { GET } from './route';

beforeEach(() => {
  mockModuleNotFoundResponse.mockResolvedValue(null);
});

const MEETING_ID = 'meeting-1';
const MEMBER = { id: 'u1', role: 'contributor', fullName: 'Ada', githubUsername: '', email: 'a@b.com' };
const ADMIN = { id: 'admin-1', role: 'admin', fullName: 'Root', githubUsername: '', email: 'r@b.com' };
const PARTICIPANTS = [
  { uuid: 'p1', sync_meeting_id: MEETING_ID, user_id: 'u1', google_user_id: 'g-111', display_name: 'Ada' },
  { uuid: 'p2', sync_meeting_id: MEETING_ID, google_user_id: 'g-222', display_name: 'Guest without account' },
];

function getParticipants() {
  const req = new NextRequest(`http://localhost/api/sync-meetings/${MEETING_ID}/participants`);
  return GET(req, { params: Promise.resolve({ id: MEETING_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue(MEMBER);
  mockCanAccessChallengeInternals.mockResolvedValue(true);
  mockMeetingFindById.mockResolvedValue({ uuid: MEETING_ID, challenge_id: 'challenge-1' });
  mockFindByMeetingId.mockResolvedValue(PARTICIPANTS);
});

describe('GET /api/sync-meetings/[id]/participants', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await getParticipants();
    expect(res.status).toBe(401);
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });

  it('returns 404 when the meeting does not exist', async () => {
    mockMeetingFindById.mockResolvedValue(null);
    const res = await getParticipants();
    expect(res.status).toBe(404);
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });

  it('returns 404 to a viewer outside the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ ...MEMBER, role: 'viewer' });
    mockCanAccessChallengeInternals.mockResolvedValue(false);

    const res = await getParticipants();

    expect(res.status).toBe(404);
    expect(mockCanAccessChallengeInternals).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'challenge-1');
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });

  it('returns participants without google_user_id to a member', async () => {
    const res = await getParticipants();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      participants: [
        { uuid: 'p1', user_id: 'u1', display_name: 'Ada' },
        { uuid: 'p2', display_name: 'Guest without account' },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('google_user_id');
    expect(mockFindByMeetingId).toHaveBeenCalledWith(MEETING_ID);
  });

  it('returns the full rows, google_user_id included, to an admin', async () => {
    mockGetSessionUser.mockResolvedValue(ADMIN);

    const res = await getParticipants();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ participants: PARTICIPANTS });
  });

  it('returns an empty list when there are no participants', async () => {
    mockFindByMeetingId.mockResolvedValue([]);

    const res = await getParticipants();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ participants: [] });
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByMeetingId.mockRejectedValue(new Error('db down'));
    const res = await getParticipants();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch participants');
  });
});

describe('when the meetings module is disabled', () => {
  beforeEach(() => {
    mockModuleNotFoundResponse.mockResolvedValue(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  });

  it('answers 404 before reading the session', async () => {
    expect((await getParticipants()).status).toBe(404);
    expect(mockModuleNotFoundResponse).toHaveBeenCalledWith('meetings');
    expect(mockGetSessionUser).not.toHaveBeenCalled();
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });
});
