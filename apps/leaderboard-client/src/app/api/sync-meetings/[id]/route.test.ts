import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken, mockVerifyAdmin, mockGetMeetingById, mockCancelMeeting,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockVerifyAdmin: vi.fn(),
  mockGetMeetingById: vi.fn(),
  mockCancelMeeting: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyRequestToken: mockVerifyRequestToken,
  verifyAdmin: mockVerifyAdmin,
}));

vi.mock('../../../../../../../packages/services/sync-meeting/sync-meeting.service.js', () => ({
  SyncMeetingService: class {
    getMeetingById = mockGetMeetingById;
    cancelMeeting = mockCancelMeeting;
  },
}));

import { GET, DELETE } from './route';

const MEETING_ID = 'meeting-1';

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
  mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/sync-meetings/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await getMeeting();
    expect(res.status).toBe(401);
    expect(mockGetMeetingById).not.toHaveBeenCalled();
  });

  it('returns 404 when the meeting does not exist', async () => {
    mockGetMeetingById.mockResolvedValue(null);
    const res = await getMeeting();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Meeting not found');
  });

  it('returns the meeting on success', async () => {
    const meeting = { uuid: MEETING_ID, title: 'Standup' };
    mockGetMeetingById.mockResolvedValue(meeting);

    const res = await getMeeting();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meeting });
    expect(mockGetMeetingById).toHaveBeenCalledWith(MEETING_ID);
  });

  it('returns 500 when the service throws', async () => {
    mockGetMeetingById.mockRejectedValue(new Error('db down'));
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
