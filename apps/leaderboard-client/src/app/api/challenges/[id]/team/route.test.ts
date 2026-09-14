import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockFindTeamMembers, mockCreate, mockVerifyRequestToken, mockGetSessionUser, mockIsManagerOfChallenge,
} = vi.hoisted(() => ({
  mockFindTeamMembers: vi.fn(),
  mockCreate: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeTeamRepository: class {
    findTeamMembers = mockFindTeamMembers;
    create = mockCreate;
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyRequestToken: mockVerifyRequestToken,
  getSessionUser: mockGetSessionUser,
}));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

import { GET, POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = '11111111-1111-4111-8111-111111111111';

// Une ligne telle que `toDomainUser` la renvoie : c'est elle qui fuyait.
const FULL_MEMBER = {
  uuid: USER_ID, full_name: 'Ada Lovelace', github_username: 'ada', avatar_url: null,
  email: 'ada@example.com', google_user_id: 'g-123', role: 'contributor', bio: 'secret bio',
};

function getTeam() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/team`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function postMember(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('GET /api/challenges/[id]/team', () => {
  it('returns 401 without a session', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await getTeam();

    expect(res.status).toBe(401);
    expect(mockFindTeamMembers).not.toHaveBeenCalled();
  });

  it('returns 403 to a viewer who does not manage the challenge', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'v1', role: 'viewer' });

    const res = await getTeam();

    expect(res.status).toBe(403);
    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith('v1', CHALLENGE_ID);
    expect(mockFindTeamMembers).not.toHaveBeenCalled();
  });

  it('returns the team to an admin, without email or google_user_id', async () => {
    mockFindTeamMembers.mockResolvedValue([FULL_MEMBER]);

    const res = await getTeam();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockFindTeamMembers).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(body[0]).toEqual({ uuid: USER_ID, full_name: 'Ada Lovelace', github_username: 'ada', avatar_url: null });
    expect(body[0].email).toBeUndefined();
    expect(body[0].google_user_id).toBeUndefined();
  });

  it('returns the team to the manager of the challenge', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'm1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockFindTeamMembers.mockResolvedValue([FULL_MEMBER]);

    const res = await getTeam();

    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain('ada@example.com');
  });

  it('returns 500 when the repository throws', async () => {
    mockFindTeamMembers.mockRejectedValue(new Error('db down'));

    const res = await getTeam();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch team' });
  });
});

describe('POST /api/challenges/[id]/team', () => {
  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postMember({ user_id: USER_ID });

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 403 to a contributor who does not manage the challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'c1', role: 'contributor' });

    const res = await postMember({ user_id: USER_ID });

    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('lets the manager of the challenge add a member', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'm1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    mockCreate.mockResolvedValue({ challenge_id: CHALLENGE_ID, user_id: USER_ID });

    const res = await postMember({ user_id: USER_ID });

    expect(res.status).toBe(201);
  });

  it('adds a team member', async () => {
    mockCreate.mockResolvedValue({ challenge_id: CHALLENGE_ID, user_id: USER_ID });

    const res = await postMember({ user_id: USER_ID });

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, user_id: USER_ID });
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 400 on invalid body (Zod)', async () => {
    const res = await postMember({ user_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when user_id is missing', async () => {
    const res = await postMember({});

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postMember({ user_id: USER_ID });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to add team member' });
  });
});
