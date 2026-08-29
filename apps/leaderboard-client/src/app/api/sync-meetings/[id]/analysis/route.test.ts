import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyRequestToken, mockFindByMeetingId } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockFindByMeetingId: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../../packages/database-service/repositories/meetingAnalysis.repo.js', () => ({
  MeetingAnalysisRepository: class {
    findByMeetingId = mockFindByMeetingId;
  },
}));

import { GET } from './route';

const MEETING_ID = 'meeting-1';

function getAnalysis() {
  const req = new NextRequest(`http://localhost/api/sync-meetings/${MEETING_ID}/analysis`);
  return GET(req, { params: Promise.resolve({ id: MEETING_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
});

describe('GET /api/sync-meetings/[id]/analysis', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await getAnalysis();
    expect(res.status).toBe(401);
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });

  it('returns 404 when no analysis exists for the meeting', async () => {
    mockFindByMeetingId.mockResolvedValue(null);
    const res = await getAnalysis();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Analysis not found');
  });

  it('returns the analysis on success', async () => {
    const analysis = { uuid: 'analysis-1', meeting_id: MEETING_ID, summary: 'Great meeting' };
    mockFindByMeetingId.mockResolvedValue(analysis);

    const res = await getAnalysis();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ analysis });
    expect(mockFindByMeetingId).toHaveBeenCalledWith(MEETING_ID);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByMeetingId.mockRejectedValue(new Error('db down'));
    const res = await getAnalysis();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch analysis');
  });
});
