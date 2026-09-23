import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted, not plain consts: vitest lifts vi.mock() above the imports, so a
// factory that closed over a `const` declared below would hit its temporal
// dead zone and throw before any test runs.
const {
  mockFindById, mockVerifyRequestToken, mockTeamFindByChallenge, mockIsManagerOfChallenge,
  mockTasks, mockMeetings, mockRepos, mockContributions,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockTeamFindByChallenge: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockTasks: vi.fn(),
  mockMeetings: vi.fn(),
  mockRepos: vi.fn(),
  mockContributions: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockFindById; },
  ChallengeTeamRepository: class {
    findTeamMembers = async () => [
      { uuid: 'u1', full_name: 'Alix C', avatar_url: null, github_username: 'alix', email: 'alix@example.com', google_user_id: 'g-1' },
    ];
    findByChallenge = mockTeamFindByChallenge;
  },
  TaskRepository: class { findByChallenge = mockTasks; },
  ChallengeRepoRepository: class { findByChallengeWithRepo = mockRepos; },
  ContributionRepository: class { findByChallenge = mockContributions; },
  ContributionMemberRepository: class { findByContributions = async () => []; },
  SyncMeetingRepository: class { findByChallengeId = mockMeetings; },
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

import { GET } from './route';

const CHALLENGE_ID = 'c1';

function get() {
  const req = new NextRequest('http://localhost/api/challenges/c1/overview', {
    headers: { host: 'localhost:3000' },
  });
  return GET(req, { params: Promise.resolve({ id: 'c1' }) });
}

// Comme `getTargets` dans le test des validation-targets : une NextRequest
// paramétrée, avec un cookie de session optionnel. `verifyRequestToken` étant
// mocké directement dans ce fichier (pas de vrai JWT ici), le token ne fait
// que piloter ce mock — le cookie reste posé pour que la requête ressemble à
// une vraie requête authentifiée.
function getOverview(token?: string) {
  mockVerifyRequestToken.mockResolvedValue(token ? { userId: 'u9', role: 'contributor' } : null);
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/overview`, {
    headers: token ? { cookie: `access_token=${token}` } : undefined,
  });
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockTeamFindByChallenge.mockResolvedValue([
    { user_id: 'u1', workspace_url: 'https://github.com/org/repo/tree/contrib/3-alix', workspace_status: 'ready' },
  ]);
  mockTasks.mockResolvedValue([]);
  mockMeetings.mockResolvedValue([]);
  mockRepos.mockResolvedValue([]);
  mockContributions.mockResolvedValue([]);
});

describe('GET /api/challenges/[id]/overview', () => {
  it('maps the payload for an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'code' });

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain('workspace_url');
    expect(JSON.stringify(body)).not.toContain('contrib/3-alix');
    expect(body.participants).toEqual([{ user_id: 'u1', group_owner_id: null }]);
    // Ni meetings lus, ni rôle vérifié : rien de tout ça ne sort pour un anonyme.
    expect(mockMeetings).not.toHaveBeenCalled();
    expect(mockIsManagerOfChallenge).not.toHaveBeenCalled();
  });

  it('never publishes a group invite token, even to a member of that group', async () => {
    // `group_id` est le lien d'invitation : le lire chez autrui reviendrait à
    // pouvoir rejoindre n'importe quel groupe sans y avoir été invité.
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'code' });
    mockTeamFindByChallenge.mockResolvedValue([
      { challenge_id: 'c1', user_id: 'u1', group_id: 'grp-1', workspace_ref: 'refs/heads/contrib/3-alix' },
      { challenge_id: 'c1', user_id: 'u2', group_id: 'grp-1' },
      { challenge_id: 'c1', user_id: 'u3', group_id: 'grp-2', workspace_ref: 'refs/heads/contrib/3-dan' },
    ]);

    const body = await (await get()).json();
    const byId = Object.fromEntries(body.participants.map((p: any) => [p.user_id, p]));

    expect(byId.u1.group_id).toBe('grp-1');       // le sien
    expect(byId.u2.group_id).toBeUndefined();     // même groupe, jeton masqué
    expect(byId.u3.group_id).toBeUndefined();     // autre groupe
    // Qui travaille avec qui reste lisible, à partir d'un user_id déjà publié.
    expect(byId.u2.group_owner_id).toBe('u1');
    expect(byId.u3.group_owner_id).toBe('u3');
  });

  it('reports the board a grouped visitor works on', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u2', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'code' });
    mockTeamFindByChallenge.mockResolvedValue([
      { challenge_id: 'c1', user_id: 'u1', group_id: 'grp-1', workspace_ref: 'refs/heads/contrib/3-alix' },
      { challenge_id: 'c1', user_id: 'u2', group_id: 'grp-1' },
    ]);

    const body = await (await get()).json();
    expect(body.my_workspace_owner_id).toBe('u1');
  });

  it('hides a draft challenge from an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'draft', type: 'code' });

    expect((await get()).status).toBe(404);
  });

  // Archivé se lit : le listing lui donne sa pastille « Archived », et une
  // page 404 sous une carte affichée serait le pire des deux mondes. Seul le
  // brouillon reste privé — il n'est pas publié.
  it('serves an archived challenge to an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'archived', type: 'code' });

    expect((await get()).status).toBe(200);
  });

  it('still serves a draft to a signed-in visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u9', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'draft', type: 'code' });

    expect((await get()).status).toBe(200);
  });

  it('serves a validation challenge to an anonymous visitor', async () => {
    // Sa page publique est la vitrine, comme pour tout type passant par le
    // brief : on la lit, on rejoint, et le parcours vient après.
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'validation' });

    expect((await get()).status).toBe(200);
  });

  it('still serves a validation challenge to a signed-in visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u9', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'validation' });

    expect((await get()).status).toBe(200);
  });
});

describe('what a signed-in visitor sees', () => {
  // u1 porte un groupe avec u2 ; u3 travaille seul. u9 ne participe pas.
  beforeEach(() => {
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'code' });
    mockTeamFindByChallenge.mockResolvedValue([
      { challenge_id: 'c1', user_id: 'u1', group_id: 'grp-1', workspace_ref: 'refs/heads/contrib/3-alix', workspace_url: 'https://github.com/org/repo/tree/contrib/3-alix', workspace_status: 'ready' },
      { challenge_id: 'c1', user_id: 'u2', group_id: 'grp-1' },
      { challenge_id: 'c1', user_id: 'u3', workspace_ref: 'refs/heads/contrib/4-dan', workspace_url: 'https://github.com/org/repo/tree/contrib/4-dan', workspace_status: 'ready' },
    ]);
    mockTasks.mockResolvedValue([
      { uuid: 't0', user_id: null, status: 'todo', title: 'Template task' },
      { uuid: 't1', user_id: 'u1', status: 'done', title: 'Alix board task', description: 'alix notes' },
      { uuid: 't3', user_id: 'u3', status: 'todo', title: 'Dan board task', description: 'dan notes' },
    ]);
    mockMeetings.mockResolvedValue([
      { uuid: 'm1', title: 'Sync', status: 'scheduled', meet_link: 'https://meet.google.com/abc', calendar_event_id: 'cal-1', conference_id: 'conf-1', conference_record_id: 'rec-1', created_by: 'admin-1' },
    ]);
    mockRepos.mockResolvedValue([
      { challenge_id: 'c1', repo_id: 'r1', role: null, repo_type: 'github', repo_title: 'org/repo', workspace_meta: { userUrls: { u1: 'https://x' } } },
    ]);
    mockContributions.mockResolvedValue([
      { uuid: 'k1', user_id: 'u1', type: 'project', reward: 10, evaluation: { globalScore: 80 }, evaluation_status: 'done' },
      { uuid: 'k3', user_id: 'u3', type: 'project', reward: 5, evaluation: { globalScore: 40 }, evaluation_status: 'done' },
    ]);
  });

  const as = async (userId: string, role = 'contributor') => {
    mockVerifyRequestToken.mockResolvedValue({ userId, role });
    return (await get()).json();
  };
  const byKey = (rows: any[], key: string) => Object.fromEntries(rows.map(r => [r[key], r]));

  it('a non-member gets progress only: no accounts, workspaces, meeting links or evaluations', async () => {
    const body = await as('u9');
    const serialised = JSON.stringify(body);

    expect(serialised).not.toContain('alix@example.com');
    expect(serialised).not.toContain('google_user_id');
    expect(serialised).not.toContain('workspace_meta');
    expect(serialised).not.toContain('workspace_url');
    expect(serialised).not.toContain('meet.google.com');
    expect(serialised).not.toContain('cal-1');
    expect(serialised).not.toContain('Alix board task');
    expect(serialised).not.toContain('Dan board task');
    expect(byKey(body.tasks, 'uuid').t0.title).toBe('Template task');
    expect(byKey(body.tasks, 'uuid').t3).toEqual({ uuid: 't3', user_id: 'u3', status: 'todo', parent_task_id: null });
    expect(body.contributions.every((c: any) => c.evaluation === null)).toBe(true);
    expect(body.meetings[0]).toMatchObject({ uuid: 'm1', title: 'Sync', status: 'scheduled' });
    expect(body.repos).toEqual([{ repo_id: 'r1', role: null, repo_type: 'github', repo_title: 'org/repo' }]);
  });

  it('a member sees their own board, branch, evaluation and meeting link — not another contributor\'s', async () => {
    const body = await as('u3');
    const tasks = byKey(body.tasks, 'uuid');
    const participants = byKey(body.participants, 'user_id');
    const contributions = byKey(body.contributions, 'uuid');

    expect(tasks.t3.title).toBe('Dan board task');
    expect(tasks.t1.title).toBeUndefined();
    expect(participants.u3.workspace_url).toBe('https://github.com/org/repo/tree/contrib/4-dan');
    expect(participants.u1.workspace_url).toBeUndefined();
    expect(contributions.k3.evaluation).toEqual({ globalScore: 40 });
    expect(contributions.k1.evaluation).toBeNull();
    expect(body.meetings[0].meet_link).toBe('https://meet.google.com/abc');
    expect(body.meetings[0].calendar_event_id).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('alix@example.com');
  });

  it('a group co-member sees the owner\'s board, branch and evaluation', async () => {
    const body = await as('u2');
    const participants = byKey(body.participants, 'user_id');
    const contributions = byKey(body.contributions, 'uuid');

    expect(body.my_workspace_owner_id).toBe('u1');
    expect(byKey(body.tasks, 'uuid').t1.title).toBe('Alix board task');
    expect(participants.u1.workspace_ref).toBe('refs/heads/contrib/3-alix');
    expect(contributions.k1.evaluation).toEqual({ globalScore: 80 });
    expect(contributions.k3.evaluation).toBeNull();
    expect(participants.u3.workspace_url).toBeUndefined();
  });

  it('a manager keeps tasks, participants and meetings whole, but not accounts or others\' evaluations', async () => {
    mockIsManagerOfChallenge.mockResolvedValue(true);
    const body = await as('m1');

    expect(mockIsManagerOfChallenge).toHaveBeenCalledWith('m1', CHALLENGE_ID);
    expect(byKey(body.tasks, 'uuid').t3.title).toBe('Dan board task');
    expect(byKey(body.participants, 'user_id').u3.workspace_status).toBe('ready');
    expect(body.meetings[0].calendar_event_id).toBe('cal-1');
    expect(body.contributions.every((c: any) => c.evaluation === null)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('alix@example.com');
    expect(JSON.stringify(body)).not.toContain('workspace_meta');
  });

  it('an admin keeps everything the manager view needs, evaluations included', async () => {
    const body = await as('admin-1', 'admin');

    expect(mockIsManagerOfChallenge).not.toHaveBeenCalled();
    expect(byKey(body.participants, 'user_id').u1.workspace_url).toBe('https://github.com/org/repo/tree/contrib/3-alix');
    expect(body.meetings[0].meet_link).toBe('https://meet.google.com/abc');
    expect(byKey(body.contributions, 'uuid').k3.evaluation).toEqual({ globalScore: 40 });
    expect(JSON.stringify(body)).not.toContain('google_user_id');
  });
});

describe('validation mode derivation', () => {
  it('publishes the source challenge type so the page knows which validation flow to render', async () => {
    // Dérivé, jamais stocké. Le publier ici évite une seconde requête sur les
    // deux coquilles de page, qui lisent déjà cet endpoint.
    mockFindById.mockImplementation(async (id: string) =>
      id === CHALLENGE_ID
        ? { uuid: CHALLENGE_ID, type: 'validation', status: 'active', source_challenge_id: 'code-ch-1' }
        : { uuid: 'code-ch-1', type: 'code' }
    );

    const body = await (await getOverview('valid-token')).json();

    expect(body.source_challenge_type).toBe('code');
  });

  it('publishes null for a challenge with no source challenge', async () => {
    mockFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', status: 'active' });

    const body = await (await getOverview('valid-token')).json();

    expect(body.source_challenge_type).toBeNull();
  });

  it('never publishes it to an anonymous visitor', async () => {
    // toPublicOverview est une liste blanche : un nouveau champ est privé par
    // défaut. Ce test est là pour que ça reste vrai si quelqu'un la réécrit.
    // Le challenge principal est de type `code` (et non `validation`) pour
    // que le visiteur anonyme atteigne bien le payload plutôt que de recevoir
    // un 404 de visibilité avant même de l'avoir vu.
    mockFindById.mockImplementation(async (id: string) =>
      id === CHALLENGE_ID
        ? { uuid: CHALLENGE_ID, type: 'code', status: 'active', source_challenge_id: 'code-ch-1' }
        : { uuid: 'code-ch-1', type: 'code' }
    );

    const res = await getOverview();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source_challenge_type).toBeUndefined();
  });
});
