import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockFindById, mockFindSubTasks, mockTeamFindByChallenge, mockVerifyRequestToken, mockCanAccessChallengeInternals,
  mockChallengeFindById,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindSubTasks: vi.fn(),
  mockTeamFindByChallenge: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockCanAccessChallengeInternals: vi.fn(),
  mockChallengeFindById: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/server/managerAuth', () => ({
  canAccessChallengeInternals: mockCanAccessChallengeInternals,
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
    findSubTasks = mockFindSubTasks;
  },
  ChallengeRepository: class {
    findById = mockChallengeFindById;
  },
  ChallengeTeamRepository: class {
    // Lue par resolveWorkspaceOwner : vide = personne en groupe.
    findByChallenge = mockTeamFindByChallenge;
  },
}));

import { GET } from './route';

const TASK_ID = 'task-1';

function getDetails() {
  const req = new NextRequest(`http://localhost/api/tasks/${TASK_ID}/details`);
  return GET(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindById.mockResolvedValue({ uuid: TASK_ID, title: 'Do the thing', challenge_id: 'challenge-1' });
  mockFindSubTasks.mockResolvedValue([]);
  mockChallengeFindById.mockResolvedValue({ uuid: 'challenge-1', slug: 'the-challenge' });
  mockTeamFindByChallenge.mockResolvedValue([]);
  mockVerifyRequestToken.mockResolvedValue(null); // visiteur anonyme par défaut
  mockCanAccessChallengeInternals.mockResolvedValue(false);
});

describe('GET /api/tasks/[id]/details — personal tasks', () => {
  const PERSONAL = { uuid: TASK_ID, title: 'Private plan', challenge_id: 'challenge-1', user_id: 'alice' };

  beforeEach(() => {
    mockFindById.mockResolvedValue(PERSONAL);
  });

  it('returns 404 to an anonymous visitor', async () => {
    const res = await getDetails();

    expect(res.status).toBe(404);
    expect(mockFindSubTasks).not.toHaveBeenCalled();
  });

  it('returns 404 to a session outside the challenge, without the title', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'mallory', role: 'contributor' });

    const res = await getDetails();

    expect(res.status).toBe(404);
    expect(mockCanAccessChallengeInternals).toHaveBeenCalledWith({ id: 'mallory', role: 'contributor' }, 'challenge-1');
    expect(JSON.stringify(await res.json())).not.toContain('Private plan');
    expect(mockFindSubTasks).not.toHaveBeenCalled();
  });

  it('serves the owner without asking for challenge access', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'alice', role: 'contributor' });

    const res = await getDetails();

    expect(res.status).toBe(200);
    expect(mockCanAccessChallengeInternals).not.toHaveBeenCalled();
  });

  it('serves a member, manager or admin of the challenge', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'bob', role: 'contributor' });
    mockCanAccessChallengeInternals.mockResolvedValue(true);

    const res = await getDetails();

    expect(res.status).toBe(200);
    expect((await res.json()).task.title).toBe('Private plan');
  });
});

describe('GET /api/tasks/[id]/details — templates', () => {
  it('stays readable without a session', async () => {
    const res = await getDetails();
    expect(res.status).toBe(200);
    expect(mockCanAccessChallengeInternals).not.toHaveBeenCalled();
  });
});

describe('GET /api/tasks/[id]/details', () => {
  it('returns 404 when the task does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getDetails();

    expect(res.status).toBe(404);
    expect(mockFindSubTasks).not.toHaveBeenCalled();
  });

  it('returns { task, subTasks } when found', async () => {
    mockFindSubTasks.mockResolvedValue([{ uuid: 'sub-1', title: 'Sub task' }]);

    const res = await getDetails();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      task: { uuid: TASK_ID, title: 'Do the thing', challenge_id: 'challenge-1' },
      subTasks: [{ uuid: 'sub-1', title: 'Sub task' }],
      board_owner_id: null, // visiteur anonyme
      // Pour « View challenge », qui mène à la page du challenge à son slug.
      challenge_slug: 'the-challenge',
    });
    expect(mockFindSubTasks).toHaveBeenCalledWith(TASK_ID);
  });

  it('reports the board holder so a group member can edit', async () => {
    // La tâche appartient au porteur : sans ce champ, la page comparerait la
    // tâche à l'id du membre et verrouillerait une édition que l'API autorise.
    mockVerifyRequestToken.mockResolvedValue({ userId: 'bob' });
    mockTeamFindByChallenge.mockResolvedValue([
      { challenge_id: 'challenge-1', user_id: 'alice', group_id: 'grp-1', workspace_ref: 'refs/heads/contrib/001-alice' },
      { challenge_id: 'challenge-1', user_id: 'bob', group_id: 'grp-1' },
    ]);

    const body = await (await getDetails()).json();
    expect(body.board_owner_id).toBe('alice');
  });

  it('reports a solo contributor as their own holder', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'bob' });
    mockTeamFindByChallenge.mockResolvedValue([{ challenge_id: 'challenge-1', user_id: 'bob' }]);

    const body = await (await getDetails()).json();
    expect(body.board_owner_id).toBe('bob');
  });

  it('returns 500 when a repository call fails', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getDetails();

    expect(res.status).toBe(500);
  });
});
