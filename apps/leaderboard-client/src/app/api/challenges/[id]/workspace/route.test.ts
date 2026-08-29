import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockJwtVerify,
  mockChallengeFindById,
  mockFindByChallengeAndUser,
  mockUpdateWorkspace,
} = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockFindByChallengeAndUser: vi.fn(),
  mockUpdateWorkspace: vi.fn(),
}));

vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  ChallengeTeamRepository: class {
    findByChallengeAndUser = mockFindByChallengeAndUser;
    updateWorkspace = mockUpdateWorkspace;
  },
}));

import { PATCH } from './route';

const CHALLENGE_ID = 'challenge-1';
const USER_ID = 'user-1';

function patchWorkspace(body: unknown, token?: string) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/workspace`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { cookie: `access_token=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: USER_ID, role: 'contributor' } });
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', workspace_mode: 'own_repo' });
  mockFindByChallengeAndUser.mockResolvedValue({ uuid: 'membership-1', challenge_id: CHALLENGE_ID, user_id: USER_ID });
  mockUpdateWorkspace.mockResolvedValue({ uuid: 'membership-1', workspace_url: 'https://github.com/acme/repo' });
});

describe('PATCH /api/challenges/[id]/workspace', () => {
  it('returns 401 without a session', async () => {
    const res = await patchWorkspace({ repo_url: 'https://github.com/acme/repo' });

    expect(res.status).toBe(401);
    expect(mockUpdateWorkspace).not.toHaveBeenCalled();
  });

  it('returns 400 when the challenge is not code/own_repo', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', workspace_mode: 'provided_repo' });

    const res = await patchWorkspace({ repo_url: 'https://github.com/acme/repo' }, 'valid-token');

    expect(res.status).toBe(400);
    expect(mockUpdateWorkspace).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not a member', async () => {
    mockFindByChallengeAndUser.mockResolvedValue(null);

    const res = await patchWorkspace({ repo_url: 'https://github.com/acme/repo' }, 'valid-token');

    expect(res.status).toBe(403);
    expect(mockUpdateWorkspace).not.toHaveBeenCalled();
  });

  it('returns 400 when repo_url is not a github.com URL', async () => {
    const res = await patchWorkspace({ repo_url: 'https://gitlab.com/acme/repo' }, 'valid-token');

    expect(res.status).toBe(400);
    expect(mockUpdateWorkspace).not.toHaveBeenCalled();
  });

  it('updates the workspace with a trimmed external repo url on success', async () => {
    const res = await patchWorkspace({ repo_url: '  https://github.com/acme/repo  ' }, 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockUpdateWorkspace).toHaveBeenCalledWith(CHALLENGE_ID, USER_ID, {
      workspace_provider: 'external',
      workspace_url: 'https://github.com/acme/repo',
      workspace_status: 'ready',
    });
    expect(body.participation).toEqual({ uuid: 'membership-1', workspace_url: 'https://github.com/acme/repo' });
  });
});
