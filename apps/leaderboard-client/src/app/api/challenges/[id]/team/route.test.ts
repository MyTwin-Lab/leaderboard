import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindTeamMembers, mockCreate } = vi.hoisted(() => ({
  mockFindTeamMembers: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeTeamRepository: class {
    findTeamMembers = mockFindTeamMembers;
    create = mockCreate;
  },
}));

import { GET, POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = '11111111-1111-4111-8111-111111111111';

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
});

describe('GET /api/challenges/[id]/team', () => {
  it('returns the team members for the challenge', async () => {
    mockFindTeamMembers.mockResolvedValue([{ uuid: USER_ID, full_name: 'Ada Lovelace' }]);

    const res = await getTeam();

    expect(res.status).toBe(200);
    expect(mockFindTeamMembers).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(await res.json()).toEqual([{ uuid: USER_ID, full_name: 'Ada Lovelace' }]);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindTeamMembers.mockRejectedValue(new Error('db down'));

    const res = await getTeam();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch team' });
  });
});

describe('POST /api/challenges/[id]/team', () => {
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
