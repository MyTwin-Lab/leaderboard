import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockGetSessionUser, mockVerifyAdmin, mockCanAccessChallengeInternals,
  mockMeetingFindById, mockCancelMeeting, mockChallengeFindById,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockVerifyAdmin: vi.fn(),
  mockCanAccessChallengeInternals: vi.fn(),
  mockMeetingFindById: vi.fn(),
  mockCancelMeeting: vi.fn(),
  mockChallengeFindById: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSessionUser: mockGetSessionUser,
  verifyAdmin: mockVerifyAdmin,
}));
vi.mock('@/lib/db', () => ({
  repositories: { challenge: { findById: mockChallengeFindById } },
}));
vi.mock('@/lib/server/managerAuth', () => ({
  canAccessChallengeInternals: mockCanAccessChallengeInternals,
}));

vi.mock('../../../../../../../packages/database-service/repositories/syncMeeting.repo.js', () => ({
  SyncMeetingRepository: class {
    findById = mockMeetingFindById;
  },
}));

vi.mock('../../../../../../../packages/services/sync-meeting/sync-meeting.service.js', () => ({
  SyncMeetingService: class {
    cancelMeeting = mockCancelMeeting;
  },
}));

// Actif par défaut dans ces tests ; le cas désactivé a son describe.
const { mockModuleNotFoundResponse } = vi.hoisted(() => ({ mockModuleNotFoundResponse: vi.fn() }));
vi.mock('@/lib/server/modules', () => ({ moduleNotFoundResponse: mockModuleNotFoundResponse }));

import { GET, DELETE } from './route';

beforeEach(() => {
  mockModuleNotFoundResponse.mockResolvedValue(null);
});

const MEETING_ID = 'meeting-1';
const VIEWER = { id: 'u1', role: 'viewer', fullName: 'Ada', githubUsername: '', email: 'a@b.com' };

const RAW_MEETING = {
  uuid: MEETING_ID,
  title: 'Standup',
  description: 'Daily',
  challenge_id: 'challenge-1',
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

function getMeeting() {
  const req = new NextRequest(`http://localhost/api/sync-meetings/${MEETING_ID}`);
  return GET(req, { params: Promise.resolve({ id: MEETING_ID }) });
}

function deleteMeeting() {
  const req = new NextRequest(`http://localhost/api/sync-meetings/${MEETING_ID}`, { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id: MEETING_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue(VIEWER);
  mockCanAccessChallengeInternals.mockResolvedValue(true);
  mockMeetingFindById.mockResolvedValue(RAW_MEETING);
  mockChallengeFindById.mockResolvedValue({ uuid: 'challenge-1', slug: 'standup-challenge' });
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/sync-meetings/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await getMeeting();
    expect(res.status).toBe(401);
    expect(mockMeetingFindById).not.toHaveBeenCalled();
  });

  it('returns 404 when the meeting does not exist', async () => {
    mockMeetingFindById.mockResolvedValue(null);
    const res = await getMeeting();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Meeting not found');
  });

  it('returns 404, not 403, to a viewer outside the challenge', async () => {
    mockCanAccessChallengeInternals.mockResolvedValue(false);

    const res = await getMeeting();

    expect(res.status).toBe(404);
    expect(mockCanAccessChallengeInternals).toHaveBeenCalledWith(VIEWER, 'challenge-1');
    expect(JSON.stringify(await res.json())).not.toContain('meet.google.com');
  });

  it('returns the whitelisted meeting to a member', async () => {
    const res = await getMeeting();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      meeting: {
        uuid: MEETING_ID,
        title: 'Standup',
        description: 'Daily',
        challenge_id: 'challenge-1',
        start_time: RAW_MEETING.start_time,
        end_time: RAW_MEETING.end_time,
        meet_link: RAW_MEETING.meet_link,
        status: 'scheduled',
        created_by: 'manager-1',
        // Pour le lien « back to challenge », qui vit au slug.
        challenge_slug: 'standup-challenge',
      },
    });
    expect(mockMeetingFindById).toHaveBeenCalledWith(MEETING_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockMeetingFindById.mockRejectedValue(new Error('db down'));
    const res = await getMeeting();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch meeting');
  });
});

describe('DELETE /api/sync-meetings/[id]', () => {
  it('returns 403 when the caller is not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    const res = await deleteMeeting();
    expect(res.status).toBe(403);
    expect(mockCancelMeeting).not.toHaveBeenCalled();
  });

  it('cancels the meeting and returns success', async () => {
    mockCancelMeeting.mockResolvedValue(undefined);
    const res = await deleteMeeting();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCancelMeeting).toHaveBeenCalledWith(MEETING_ID);
  });

  it('returns 500 when cancelling fails', async () => {
    mockCancelMeeting.mockRejectedValue(new Error('db down'));
    const res = await deleteMeeting();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to cancel meeting');
  });
});

describe('when the meetings module is disabled', () => {
  beforeEach(() => {
    mockModuleNotFoundResponse.mockResolvedValue(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  });

  it('answers 404 to GET and DELETE, before reading the session', async () => {
    expect((await getMeeting()).status).toBe(404);
    expect((await deleteMeeting()).status).toBe(404);
    expect(mockModuleNotFoundResponse).toHaveBeenCalledWith('meetings');
    expect(mockGetSessionUser).not.toHaveBeenCalled();
    expect(mockVerifyAdmin).not.toHaveBeenCalled();
    expect(mockCancelMeeting).not.toHaveBeenCalled();
  });
});
