import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockFindSubTasks, mockTeamFindByChallenge, mockVerifyRequestToken } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindSubTasks: vi.fn(),
  mockTeamFindByChallenge: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  TaskRepository: class {
    findById = mockFindById;
    findSubTasks = mockFindSubTasks;
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
  mockTeamFindByChallenge.mockResolvedValue([]);
  mockVerifyRequestToken.mockResolvedValue(null); // visiteur anonyme par défaut
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
