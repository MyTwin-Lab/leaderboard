import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted, not plain consts: vitest lifts vi.mock() above the imports, so a
// factory that closed over a `const` declared below would hit its temporal
// dead zone and throw before any test runs.
const { mockFindById, mockVerifyRequestToken } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockFindById; },
  ChallengeTeamRepository: class {
    findTeamMembers = async () => [
      { uuid: 'u1', full_name: 'Alix C', avatar_url: null, github_username: 'alix', email: 'alix@example.com' },
    ];
    findByChallenge = async () => [
      { user_id: 'u1', workspace_url: 'https://github.com/org/repo/tree/contrib/3-alix', workspace_status: 'ready' },
    ];
  },
  TaskRepository: class { findByChallenge = async () => []; },
  ChallengeRepoRepository: class { findByChallengeWithRepo = async () => []; },
  ContributionRepository: class { findByChallenge = async () => []; },
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
    expect(body.participants).toEqual([{ user_id: 'u1' }]);
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
