import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted, not plain consts: vitest lifts vi.mock() above the imports, so a
// factory that closed over a `const` declared below would hit its temporal
// dead zone and throw before any test runs.
const { mockFindById, mockVerifyRequestToken, mockTeamFindByChallenge } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockTeamFindByChallenge: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockFindById; },
  ChallengeTeamRepository: class {
    findTeamMembers = async () => [
      { uuid: 'u1', full_name: 'Alix C', avatar_url: null, github_username: 'alix', email: 'alix@example.com' },
    ];
    findByChallenge = mockTeamFindByChallenge;
  },
  TaskRepository: class { findByChallenge = async () => []; },
  ChallengeRepoRepository: class { findByChallengeWithRepo = async () => []; },
  ContributionRepository: class { findByChallenge = async () => []; },
  ContributionMemberRepository: class { findByContributions = async () => []; },
}));

vi.mock('../../../../../../../../packages/services/sync-meeting/sync-meeting.service.js', () => ({
  SyncMeetingService: class { getMeetingsByChallengeId = async () => []; },
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

import { GET } from './route';

function get() {
  const req = new NextRequest('http://localhost/api/challenges/c1/overview', {
    headers: { host: 'localhost:3000' },
  });
  return GET(req, { params: Promise.resolve({ id: 'c1' }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTeamFindByChallenge.mockResolvedValue([
    { user_id: 'u1', workspace_url: 'https://github.com/org/repo/tree/contrib/3-alix', workspace_status: 'ready' },
  ]);
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

  it('leaves the payload whole for a signed-in visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u9', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'code' });

    const body = await (await get()).json();

    expect(body.participants[0].workspace_url).toBe('https://github.com/org/repo/tree/contrib/3-alix');
    expect(body.meetings).toBeDefined();
  });

  it('hides a draft challenge from an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'draft', type: 'code' });

    expect((await get()).status).toBe(404);
  });

  it('hides an archived challenge from an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'archived', type: 'code' });

    expect((await get()).status).toBe(404);
  });

  it('still serves a draft to a signed-in visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u9', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'draft', type: 'code' });

    expect((await get()).status).toBe(200);
  });

  it('hides a validation challenge from an anonymous visitor', async () => {
    // No public view applies to this type — neither metrics nor task progress.
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'validation' });

    expect((await get()).status).toBe(404);
  });

  it('still serves a validation challenge to a signed-in visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u9', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'validation' });

    expect((await get()).status).toBe(200);
  });
});
