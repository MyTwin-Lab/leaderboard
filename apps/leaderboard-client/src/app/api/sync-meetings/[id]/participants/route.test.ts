import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyRequestToken, mockFindByMeetingId } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockFindByMeetingId: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../../packages/database-service/repositories/meetingParticipant.repo.js', () => ({
  MeetingParticipantRepository: class {
    findByMeetingId = mockFindByMeetingId;
  },
}));

import { GET } from './route';

const MEETING_ID = 'meeting-1';

function getParticipants() {
  const req = new NextRequest(`http://localhost/api/sync-meetings/${MEETING_ID}/participants`);
  return GET(req, { params: Promise.resolve({ id: MEETING_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
});

describe('GET /api/sync-meetings/[id]/participants', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await getParticipants();
    expect(res.status).toBe(401);
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });

  it('returns the list of participants on success', async () => {
    const participants = [{ uuid: 'p1', meeting_id: MEETING_ID, user_id: 'u1' }];
    mockFindByMeetingId.mockResolvedValue(participants);

    const res = await getParticipants();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ participants });
    expect(mockFindByMeetingId).toHaveBeenCalledWith(MEETING_ID);
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
