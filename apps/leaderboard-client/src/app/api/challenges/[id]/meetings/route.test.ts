import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockGetSessionUser, mockCanAccessChallengeInternals, mockIsManagerOfChallenge,
  mockFindByChallengeId, mockModuleNotFoundResponse,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockCanAccessChallengeInternals: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindByChallengeId: vi.fn(),
  mockModuleNotFoundResponse: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({
  canAccessChallengeInternals: mockCanAccessChallengeInternals,
  isManagerOfChallenge: mockIsManagerOfChallenge,
}));
vi.mock('@/lib/server/modules', () => ({ moduleNotFoundResponse: mockModuleNotFoundResponse }));
vi.mock('../../../../../../../../packages/database-service/repositories/syncMeeting.repo.js', () => ({
  SyncMeetingRepository: class { findByChallengeId = mockFindByChallengeId; },
}));

import { GET } from './route';

const CHALLENGE_ID = 'c1';
const MEMBER = { id: 'u1', role: 'contributor', fullName: 'Ada', githubUsername: '', email: 'a@b.com' };
const ADMIN = { id: 'admin-1', role: 'admin', fullName: 'Root', githubUsername: '', email: 'r@b.com' };

const RAW_MEETING = {
  uuid: 'm1',
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
  created_by: 'admin-1',
};

function getMeetings() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/meetings`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockModuleNotFoundResponse.mockResolvedValue(null);
  mockGetSessionUser.mockResolvedValue(MEMBER);
  mockCanAccessChallengeInternals.mockResolvedValue(true);
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockFindByChallengeId.mockResolvedValue([RAW_MEETING]);
});

describe('GET /api/challenges/[id]/meetings', () => {
  it('answers 404 while the meetings module is disabled, before reading the session', async () => {
    mockModuleNotFoundResponse.mockResolvedValue(NextResponse.json({ error: 'Not found' }, { status: 404 }));

    const res = await getMeetings();

    expect(res.status).toBe(404);
    expect(mockModuleNotFoundResponse).toHaveBeenCalledWith('meetings');
    expect(mockGetSessionUser).not.toHaveBeenCalled();
    expect(mockFindByChallengeId).not.toHaveBeenCalled();
  });

  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await getMeetings()).status).toBe(401);
  });

  it('returns 403 to someone outside the challenge', async () => {
    mockCanAccessChallengeInternals.mockResolvedValue(false);

    const res = await getMeetings();

    expect(res.status).toBe(403);
    expect(mockCanAccessChallengeInternals).toHaveBeenCalledWith(MEMBER, CHALLENGE_ID);
    expect(mockFindByChallengeId).not.toHaveBeenCalled();
  });

  it('gives a member the meeting link, never the calendar or conference ids', async () => {
    const body = await (await getMeetings()).json();

    expect(body.meetings).toEqual([{
      uuid: 'm1', title: 'Sync', description: 'Weekly', challenge_id: CHALLENGE_ID,
      start_time: RAW_MEETING.start_time, end_time: RAW_MEETING.end_time,
      meet_link: 'https://meet.google.com/abc', status: 'scheduled', created_by: 'admin-1',
    }]);
  });

  it('keeps meetings whole for a manager of the challenge', async () => {
    mockIsManagerOfChallenge.mockResolvedValue(true);

    const body = await (await getMeetings()).json();

    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith('u1', CHALLENGE_ID);
    expect(body.meetings[0].calendar_event_id).toBe('cal-1');
  });

  it('keeps meetings whole for an admin', async () => {
    mockGetSessionUser.mockResolvedValue(ADMIN);

    const body = await (await getMeetings()).json();

    expect(mockIsManagerOfChallenge).not.toHaveBeenCalled();
    expect(body.meetings[0]).toEqual(RAW_MEETING);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByChallengeId.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await getMeetings()).status).toBe(500);
  });
});
