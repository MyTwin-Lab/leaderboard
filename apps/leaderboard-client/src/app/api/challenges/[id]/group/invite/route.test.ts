import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetSessionUser, mockFindByChallengeAndUser, mockFindChallengeById,
  mockFindUserById, mockInsertIfAbsent,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockFindByChallengeAndUser: vi.fn(),
  mockFindChallengeById: vi.fn(),
  mockFindUserById: vi.fn(),
  mockInsertIfAbsent: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeTeamRepository: class { findByChallengeAndUser = mockFindByChallengeAndUser; },
  ChallengeRepository: class { findById = mockFindChallengeById; },
  UserRepository: class { findById = mockFindUserById; },
  NotificationRepository: class { insertIfAbsent = mockInsertIfAbsent; },
  buildGroupInviteDraft: (input: Record<string, unknown>) => ({
    user_id: input.recipientId,
    type: 'group_invite',
    payload: input,
    dedupe_key: input.groupToken,
  }),
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const CALLER = '11111111-1111-4111-8111-111111111111';
const RECIPIENT = '22222222-2222-4222-8222-222222222222';

function invite(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/group/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: CALLER, role: 'contributor' });
  mockFindChallengeById.mockResolvedValue({
    uuid: CHALLENGE_ID, title: 'Collaboration Patterns', status: 'active',
  });
  mockFindUserById.mockImplementation(async (id: string) =>
    id === CALLER
      ? { uuid: CALLER, full_name: 'Camille Daverio' }
      : { uuid: id, full_name: 'Patricia Novi' });
  mockInsertIfAbsent.mockResolvedValue({ uuid: 'n-1' });
  // Par défaut l'appelant est bien dans le groupe qu'il invite.
  mockFindByChallengeAndUser.mockImplementation(async (_c: string, u: string) =>
    u === CALLER ? { user_id: CALLER, group_id: 'group-abc' } : null);
});

describe('POST /api/challenges/[id]/group/invite', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await invite({ userId: RECIPIENT })).status).toBe(401);
  });

  it('refuses a caller who is not on the challenge', async () => {
    mockFindByChallengeAndUser.mockResolvedValue(null);

    const res = await invite({ userId: RECIPIENT });

    expect(res.status).toBe(403);
    expect(mockInsertIfAbsent).not.toHaveBeenCalled();
  });

  it('refuses a caller who joined solo — they have no group to invite into', async () => {
    // La garde du fichier : sans elle, n'importe quel compte connecté pourrait
    // diffuser le jeton de n'importe quel groupe.
    mockFindByChallengeAndUser.mockImplementation(async (_c: string, u: string) =>
      u === CALLER ? { user_id: CALLER, group_id: null } : null);

    const res = await invite({ userId: RECIPIENT });

    expect(res.status).toBe(403);
    expect(mockInsertIfAbsent).not.toHaveBeenCalled();
  });

  it('refuses inviting yourself', async () => {
    expect((await invite({ userId: CALLER })).status).toBe(400);
  });

  it('refuses a body without a well-formed contributor id', async () => {
    expect((await invite({ userId: 'not-a-uuid' })).status).toBe(400);
    expect((await invite({})).status).toBe(400);
  });

  it('refuses an unknown recipient', async () => {
    mockFindUserById.mockImplementation(async (id: string) =>
      id === CALLER ? { uuid: CALLER, full_name: 'Camille Daverio' } : null);

    expect((await invite({ userId: RECIPIENT })).status).toBe(404);
  });

  it('refuses when the challenge is closed', async () => {
    mockFindChallengeById.mockResolvedValue({ uuid: CHALLENGE_ID, title: 'X', status: 'completed' });

    expect((await invite({ userId: RECIPIENT })).status).toBe(403);
  });

  it('writes the invite with the caller group token', async () => {
    const res = await invite({ userId: RECIPIENT });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ sent: true });
    expect(mockInsertIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
      user_id: RECIPIENT,
      type: 'group_invite',
      dedupe_key: 'group-abc',
    }));
  });

  it('reports success when the invite already existed', async () => {
    // `insertIfAbsent` rend `null` quand la ligne existe déjà. Du point de vue
    // de l'expéditeur, la personne est invitée dans les deux cas.
    mockInsertIfAbsent.mockResolvedValue(null);

    const res = await invite({ userId: RECIPIENT });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ sent: true });
  });
});
