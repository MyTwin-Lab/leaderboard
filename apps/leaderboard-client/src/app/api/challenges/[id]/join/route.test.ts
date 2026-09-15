import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken,
  mockChallengeFindById,
  mockChallengeTeamFindByChallengeAndUser,
  mockChallengeTeamCreate,
  mockChallengeTeamFindByGroup,
  mockUsesBoard,
  mockCopyBoardTemplate,
  mockFlowUses,
  mockRunJoinHooks,
  mockRunGroupJoinHooks,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockChallengeTeamFindByChallengeAndUser: vi.fn(),
  mockChallengeTeamCreate: vi.fn(),
  mockChallengeTeamFindByGroup: vi.fn(),
  mockUsesBoard: vi.fn(),
  mockCopyBoardTemplate: vi.fn(),
  mockFlowUses: vi.fn(),
  mockRunJoinHooks: vi.fn(),
  mockRunGroupJoinHooks: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyRequestToken: mockVerifyRequestToken,
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  ChallengeTeamRepository: class {
    findByChallengeAndUser = mockChallengeTeamFindByChallengeAndUser;
    create = mockChallengeTeamCreate;
    findByGroup = mockChallengeTeamFindByGroup;
  },
}));

vi.mock('../../../../../../../../packages/capabilities/board', () => ({
  usesBoard: mockUsesBoard,
  copyBoardTemplate: mockCopyBoardTemplate,
}));

vi.mock('../../../../../../../../packages/capabilities/challenge-hooks', () => ({
  flowUses: mockFlowUses,
  runJoinHooks: mockRunJoinHooks,
  runGroupJoinHooks: mockRunGroupJoinHooks,
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';
const CHALLENGE = { uuid: CHALLENGE_ID, type: 'code', flow_config: { workspace_mode: 'provided_repo' }, index: 3 };

function joinChallenge(body?: Record<string, unknown>) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/join`, {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'alice' });
  mockChallengeFindById.mockResolvedValue(CHALLENGE);
  mockChallengeTeamFindByChallengeAndUser.mockResolvedValue(null);
  mockChallengeTeamCreate.mockResolvedValue({});
  mockChallengeTeamFindByGroup.mockResolvedValue([]);
  mockUsesBoard.mockReturnValue(true);
  mockCopyBoardTemplate.mockResolvedValue(3);
  mockFlowUses.mockReturnValue(true);
  mockRunJoinHooks.mockResolvedValue({});
  mockRunGroupJoinHooks.mockResolvedValue({});
});

describe('POST /api/challenges/[id]/join', () => {
  it('returns 401 without a session', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await joinChallenge();

    expect(res.status).toBe(401);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('returns 403 when the challenge is closed (completed or archived)', async () => {
    mockChallengeFindById.mockResolvedValue({ ...CHALLENGE, status: 'completed' });

    const res = await joinChallenge();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('This challenge is closed');
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when already a member', async () => {
    mockChallengeTeamFindByChallengeAndUser.mockResolvedValue({ challenge_id: CHALLENGE_ID, user_id: 'alice' });

    const res = await joinChallenge();

    expect(res.status).toBe(409);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('creates the participation, copies the board, then runs the join hooks and reports what they add', async () => {
    mockRunJoinHooks.mockResolvedValue({ workspace: 'ready' });

    const res = await joinChallenge();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockChallengeTeamCreate).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, user_id: 'alice' });
    expect(mockCopyBoardTemplate).toHaveBeenCalledWith(CHALLENGE_ID, 'alice');
    expect(mockRunJoinHooks).toHaveBeenCalledWith({ challenge: CHALLENGE, userId: 'alice', groupId: null });
    expect(mockCopyBoardTemplate.mock.invocationCallOrder[0]).toBeLessThan(mockRunJoinHooks.mock.invocationCallOrder[0]);
    expect(body).toMatchObject({ tasksCreated: 3, workspace: 'ready' });
  });

  it('copies no board for a flow without one', async () => {
    mockUsesBoard.mockReturnValue(false);

    const body = await (await joinChallenge()).json();

    expect(body.tasksCreated).toBe(0);
    expect(mockCopyBoardTemplate).not.toHaveBeenCalled();
    expect(mockRunJoinHooks).toHaveBeenCalled();
  });

  it('returns 500 when a join hook fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRunJoinHooks.mockRejectedValue(new Error('provider exploded'));

    const res = await joinChallenge();

    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('POST /api/challenges/[id]/join — groups', () => {
  const GROUP = '11111111-1111-4111-8111-111111111111';

  it('joins solo when no body is sent, exactly as before', async () => {
    await joinChallenge();
    expect(mockChallengeTeamCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ group_id: expect.anything() })
    );
  });

  it('creates a group and returns its invite token', async () => {
    const body = await (await joinChallenge({ mode: 'group' })).json();

    expect(body.group_id).toEqual(expect.any(String));
    // Le créateur reste un participant normal : board copié, hooks de join.
    expect(mockChallengeTeamCreate).toHaveBeenCalledWith(expect.objectContaining({ group_id: body.group_id }));
    expect(mockCopyBoardTemplate).toHaveBeenCalled();
    expect(mockRunJoinHooks).toHaveBeenCalledWith(expect.objectContaining({ groupId: body.group_id }));
  });

  it('refuses a group on a flow that does not accept groups', async () => {
    mockFlowUses.mockReturnValue(false);

    const created = await joinChallenge({ mode: 'group' });
    const invited = await joinChallenge({ group: GROUP });

    expect(created.status).toBe(400);
    expect(invited.status).toBe(400);
    expect(mockFlowUses).toHaveBeenCalledWith('code', 'groups');
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('joins an existing group without copying a board, and runs the group hooks', async () => {
    // Le workspace est celui du porteur : dupliquer board et branche donnerait
    // exactement ce que le modèle de groupe cherche à éviter.
    mockVerifyRequestToken.mockResolvedValue({ userId: 'bob' });
    mockChallengeTeamFindByGroup.mockResolvedValue([
      { challenge_id: CHALLENGE_ID, user_id: 'alice', group_id: GROUP, workspace_ref: 'refs/heads/contrib/003-alice' },
    ]);
    mockRunGroupJoinHooks.mockResolvedValue({ missingGithub: ['Bob'] });

    const res = await joinChallenge({ group: GROUP });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ tasksCreated: 0, group_id: GROUP, missingGithub: ['Bob'] });
    expect(mockCopyBoardTemplate).not.toHaveBeenCalled();
    expect(mockRunJoinHooks).not.toHaveBeenCalled();
    expect(mockRunGroupJoinHooks).toHaveBeenCalledWith({ challenge: CHALLENGE, userId: 'bob', groupId: GROUP });
    expect(mockChallengeTeamCreate).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID, user_id: 'bob', group_id: GROUP,
    });
  });

  it('refuses an unknown group', async () => {
    mockChallengeTeamFindByGroup.mockResolvedValue([]);

    const res = await joinChallenge({ group: GROUP });

    expect(res.status).toBe(404);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('refuses a group that is already full', async () => {
    mockChallengeTeamFindByGroup.mockResolvedValue([
      { challenge_id: CHALLENGE_ID, user_id: 'alice', group_id: GROUP, workspace_ref: 'refs/heads/x' },
      { challenge_id: CHALLENGE_ID, user_id: 'bob', group_id: GROUP },
      { challenge_id: CHALLENGE_ID, user_id: 'carol', group_id: GROUP },
    ]);

    const res = await joinChallenge({ group: GROUP });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/full/);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('refuses to switch from solo to group', async () => {
    // Le contributeur a déjà un board copié et une branche provisionnée.
    mockChallengeTeamFindByChallengeAndUser.mockResolvedValue({ challenge_id: CHALLENGE_ID, user_id: 'alice' });

    const res = await joinChallenge({ group: GROUP });

    expect(res.status).toBe(409);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });

  it('rejects a malformed group token', async () => {
    const res = await joinChallenge({ group: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(mockChallengeTeamCreate).not.toHaveBeenCalled();
  });
});
