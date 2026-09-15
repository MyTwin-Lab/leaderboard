import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken,
  mockChallengeFindById,
  mockMeetingFindById,
  mockCanAccessChallengeInternals,
  mockIsPubliclyVisible,
  mockEmit,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockMeetingFindById: vi.fn(),
  mockCanAccessChallengeInternals: vi.fn(),
  mockIsPubliclyVisible: vi.fn(),
  mockEmit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/db', () => ({ repositories: { challenge: { findById: mockChallengeFindById } } }));
vi.mock('@/lib/server/managerAuth', () => ({ canAccessChallengeInternals: mockCanAccessChallengeInternals }));
vi.mock('@/lib/public/challengeVisibility', () => ({ isPubliclyVisible: mockIsPubliclyVisible }));
vi.mock('../../../../../../../packages/database-service/repositories/syncMeeting.repo', () => ({
  SyncMeetingRepository: class {
    findById = mockMeetingFindById;
  },
}));
vi.mock('../../../../../../../packages/capabilities/events', () => ({ events: { emit: mockEmit } }));

import { POST } from './route';

const CHALLENGE_ID = '11111111-1111-4111-8111-111111111111';
const MEETING_ID = '33333333-3333-4333-8333-333333333333';

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/events/ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'alice', role: 'contributor' });
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, status: 'draft', type: 'code' });
  mockIsPubliclyVisible.mockReturnValue(false);
  mockCanAccessChallengeInternals.mockResolvedValue(false);
  mockMeetingFindById.mockResolvedValue({ uuid: MEETING_ID, challenge_id: CHALLENGE_ID });
  mockEmit.mockResolvedValue(1);
});

describe('POST /api/events/ui', () => {
  it('returns 401 without a session', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await post({ type: 'ui.challenge_opened', payload: { challengeId: CHALLENGE_ID } });

    expect(res.status).toBe(401);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('refuses an event that is not an interface event', async () => {
    const res = await post({ type: 'task.created', payload: { userId: 'alice' } });

    expect(res.status).toBe(400);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('refuses an interface event the platform does not declare', async () => {
    const res = await post({ type: 'ui.anything', payload: {} });

    expect(res.status).toBe(400);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON', async () => {
    const res = await POST(new NextRequest('http://localhost/api/events/ui', { method: 'POST', body: 'nope' }));

    expect(res.status).toBe(400);
  });

  describe('ui.challenge_opened', () => {
    it('records a public challenge for the signed-in user, never the user the body names', async () => {
      mockIsPubliclyVisible.mockReturnValue(true);

      const res = await post({ type: 'ui.challenge_opened', payload: { challengeId: CHALLENGE_ID, userId: 'mallory' } });

      expect(res.status).toBe(204);
      expect(mockEmit).toHaveBeenCalledWith('ui.challenge_opened', { challengeId: CHALLENGE_ID, userId: 'alice' });
      expect(mockCanAccessChallengeInternals).not.toHaveBeenCalled();
    });

    it('records a private challenge whose internals the caller can see', async () => {
      mockCanAccessChallengeInternals.mockResolvedValue(true);

      const res = await post({ type: 'ui.challenge_opened', payload: { challengeId: CHALLENGE_ID } });

      expect(res.status).toBe(204);
      expect(mockCanAccessChallengeInternals).toHaveBeenCalledWith({ id: 'alice', role: 'contributor' }, CHALLENGE_ID);
      expect(mockEmit).toHaveBeenCalledOnce();
    });

    it('returns 404 for a challenge the caller cannot see', async () => {
      const res = await post({ type: 'ui.challenge_opened', payload: { challengeId: CHALLENGE_ID } });

      expect(res.status).toBe(404);
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown challenge or a malformed id', async () => {
      mockChallengeFindById.mockResolvedValue(null);

      expect((await post({ type: 'ui.challenge_opened', payload: { challengeId: CHALLENGE_ID } })).status).toBe(404);
      expect((await post({ type: 'ui.challenge_opened', payload: { challengeId: 'not-a-uuid' } })).status).toBe(404);
      expect(mockChallengeFindById).toHaveBeenCalledOnce();
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  describe('ui.meeting_link_opened', () => {
    it('records a meeting of a challenge whose internals the caller can see', async () => {
      mockCanAccessChallengeInternals.mockResolvedValue(true);

      const res = await post({ type: 'ui.meeting_link_opened', payload: { meetingId: MEETING_ID } });

      expect(res.status).toBe(204);
      expect(mockEmit).toHaveBeenCalledWith('ui.meeting_link_opened', {
        meetingId: MEETING_ID,
        challengeId: CHALLENGE_ID,
        userId: 'alice',
      });
    });

    it('returns 404 for a meeting the caller cannot reach', async () => {
      const res = await post({ type: 'ui.meeting_link_opened', payload: { meetingId: MEETING_ID } });

      expect(res.status).toBe(404);
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
