import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

vi.mock('../../../../../../../../packages/database-service/repositories/meetingAnalysis.repo.js', () => ({
  MeetingAnalysisRepository: class {
    findByMeetingId = mockFindByMeetingId;
  },
}));

import { GET } from './route';

const MEETING_ID = 'meeting-1';
const MEMBER = { id: 'u1', role: 'contributor', fullName: 'Ada', githubUsername: '', email: 'a@b.com' };
const ADMIN = { id: 'admin-1', role: 'admin', fullName: 'Root', githubUsername: '', email: 'r@b.com' };

// Ligne historique : les analyses antérieures au retrait des poids les portent encore.
const RAW_ANALYSIS = {
  uuid: 'analysis-1',
  sync_meeting_id: MEETING_ID,
  summary: 'Great meeting',
  decisions: [{ description: 'Ship it' }],
  actions: [{ description: 'Write docs', assignee: 'Ada' }],
  contribution_signals: [{ display_name: 'Ada', signal_type: 'coordination', weight: 0.9 }],
  status: 'completed',
  processed_at: '2026-01-01T12:00:00.000Z',
  error_message: 'internal detail',
  created_at: '2026-01-01T11:00:00.000Z',
};

function getAnalysis() {
  const req = new NextRequest(`http://localhost/api/sync-meetings/${MEETING_ID}/analysis`);
  return GET(req, { params: Promise.resolve({ id: MEETING_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue(MEMBER);
  mockCanAccessChallengeInternals.mockResolvedValue(true);
  mockMeetingFindById.mockResolvedValue({ uuid: MEETING_ID, challenge_id: 'challenge-1' });
  mockFindByMeetingId.mockResolvedValue(RAW_ANALYSIS);
});

describe('GET /api/sync-meetings/[id]/analysis', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await getAnalysis();
    expect(res.status).toBe(401);
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });

  it('returns 404 to a viewer outside the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ ...MEMBER, role: 'viewer' });
    mockCanAccessChallengeInternals.mockResolvedValue(false);

    const res = await getAnalysis();

    expect(res.status).toBe(404);
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });

  it('returns 404 when the meeting does not exist', async () => {
    mockMeetingFindById.mockResolvedValue(null);
    const res = await getAnalysis();
    expect(res.status).toBe(404);
    expect(mockFindByMeetingId).not.toHaveBeenCalled();
  });

  it('returns 404 when no analysis exists for the meeting', async () => {
    mockFindByMeetingId.mockResolvedValue(null);
    const res = await getAnalysis();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Analysis not found');
  });

  it('returns the analysis without contribution_signals to a member', async () => {
    const res = await getAnalysis();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      analysis: {
        summary: 'Great meeting',
        decisions: [{ description: 'Ship it' }],
        actions: [{ description: 'Write docs', assignee: 'Ada' }],
        status: 'completed',
        processed_at: '2026-01-01T12:00:00.000Z',
      },
    });
    expect(JSON.stringify(body)).not.toContain('contribution_signals');
    expect(JSON.stringify(body)).not.toContain('weight');
    expect(mockFindByMeetingId).toHaveBeenCalledWith(MEETING_ID);
  });

  it('returns the full analysis to an admin', async () => {
    mockGetSessionUser.mockResolvedValue(ADMIN);

    const res = await getAnalysis();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ analysis: RAW_ANALYSIS });
  });

  it('returns 500 when the repository throws', async () => {
    mockFindByMeetingId.mockRejectedValue(new Error('db down'));
    const res = await getAnalysis();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch analysis');
  });
});
