import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken,
  mockChallengeFindById,
  mockFindByGroup,
  mockFindByChallengeAndUser,
  mockUserFindById,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockFindByGroup: vi.fn(),
  mockFindByChallengeAndUser: vi.fn(),
  mockUserFindById: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockChallengeFindById; },
  ChallengeTeamRepository: class {
    findByGroup = mockFindByGroup;
    findByChallengeAndUser = mockFindByChallengeAndUser;
  },
  UserRepository: class { findById = mockUserFindById; },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';
const TOKEN = 'grp-1';

function readInvite() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/group/${TOKEN}`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID, token: TOKEN }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'bob' });
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, status: 'active', type: 'code' });
  mockFindByGroup.mockResolvedValue([
    { challenge_id: CHALLENGE_ID, user_id: 'alice', group_id: TOKEN, workspace_ref: 'refs/heads/contrib/003-alice' },
  ]);
  mockFindByChallengeAndUser.mockResolvedValue(null);
  mockUserFindById.mockResolvedValue({ uuid: 'alice', full_name: 'Alice Martin' });
});

describe('GET /api/challenges/[id]/group/[token]', () => {
  it('names the holder so the invite screen can address it', async () => {
    const body = await (await readInvite()).json();

    expect(body).toMatchObject({ ownerName: 'Alice Martin', size: 1, joinable: true, reason: null });
  });

  it('requires a session — an invite means nothing to a visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    expect((await readInvite()).status).toBe(401);
  });

  it('404s on an unknown token rather than listing anything', async () => {
    // C'est ce qui garde le lien secret : sans le jeton exact, aucune réponse.
    mockFindByGroup.mockResolvedValue([]);
    expect((await readInvite()).status).toBe(404);
  });

  it('reports a full group instead of failing at the click', async () => {
    mockFindByGroup.mockResolvedValue([
      { challenge_id: CHALLENGE_ID, user_id: 'alice', group_id: TOKEN, workspace_ref: 'refs/heads/x' },
      { challenge_id: CHALLENGE_ID, user_id: 'carol', group_id: TOKEN },
      { challenge_id: CHALLENGE_ID, user_id: 'dan', group_id: TOKEN },
    ]);

    const body = await (await readInvite()).json();

    expect(body.joinable).toBe(false);
    expect(body.reason).toBe('group_full');
  });

  it('reports a closed challenge', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, status: 'completed', type: 'code' });

    const body = await (await readInvite()).json();

    expect(body.joinable).toBe(false);
    expect(body.reason).toBe('challenge_closed');
  });

  it('reports that a solo participant cannot switch over', async () => {
    // La bascule est refusée : board déjà copié, branche déjà provisionnée.
    mockFindByChallengeAndUser.mockResolvedValue({ challenge_id: CHALLENGE_ID, user_id: 'bob' });

    const body = await (await readInvite()).json();

    expect(body.joinable).toBe(false);
    expect(body.reason).toBe('already_solo');
  });

  it('reports an existing member of that same group', async () => {
    mockFindByGroup.mockResolvedValue([
      { challenge_id: CHALLENGE_ID, user_id: 'alice', group_id: TOKEN, workspace_ref: 'refs/heads/x' },
      { challenge_id: CHALLENGE_ID, user_id: 'bob', group_id: TOKEN },
    ]);
    mockFindByChallengeAndUser.mockResolvedValue({ challenge_id: CHALLENGE_ID, user_id: 'bob', group_id: TOKEN });

    const body = await (await readInvite()).json();

    expect(body.reason).toBe('already_member');
  });
});
