import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockList, mockCount, mockFetchContributorSession } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCount: vi.fn(),
  mockFetchContributorSession: vi.fn(),
}));

vi.mock('@packages/database-service/repositories', () => ({
  DigestRepository: class {
    list = mockList;
    count = mockCount;
  },
}));

vi.mock('@/lib/contributor', () => ({
  fetchContributorSession: mockFetchContributorSession,
}));

import { GET } from './route';

function get(url = 'http://localhost/api/admin/digests') {
  return GET(new Request(url));
}

const DIGEST = {
  uuid: 'd-1',
  period_start: new Date('2026-08-29T06:00:00Z'),
  period_end: new Date('2026-09-05T06:00:00Z'),
  generated_at: new Date('2026-09-05T06:00:01Z'),
  trigger_source: 'cron',
  payload: {
    version: 1,
    new_contributions: [{ contribution_id: 'c-1' }],
    new_challenges: [],
    completed_challenges: [],
    new_contributors: [],
    cp_distributed: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCount.mockResolvedValue(1);
  mockList.mockResolvedValue([DIGEST]);
});

describe('GET /api/admin/digests', () => {
  it('refuses an anonymous caller', async () => {
    mockFetchContributorSession.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });

  it('refuses a contributor', async () => {
    // Le proxy ne filtre que les écritures : un GET admin doit se défendre
    // lui-même.
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'contributor' });
    expect((await get()).status).toBe(403);
  });

  it('returns the digests for an admin', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    const res = await get();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.digests).toHaveLength(1);
    expect(body.digests[0].uuid).toBe('d-1');
    expect(body.digests[0].trigger_source).toBe('cron');
  });

  it('does not ship the full payload in the list', async () => {
    // L'historique se déplie entrée par entrée : embarquer chaque payload
    // ferait grossir la liste avec l'activité de toute la plateforme.
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    const body = await (await get()).json();
    expect(body.digests[0].payload).toBeUndefined();
    expect(body.digests[0].counts).toEqual({
      new_contributions: 1,
      new_challenges: 0,
      completed_challenges: 0,
      new_contributors: 0,
      cp_distributed: 0,
    });
  });

  it('honours limit and offset', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    await get('http://localhost/api/admin/digests?limit=5&offset=10');
    expect(mockList).toHaveBeenCalledWith(5, 10);
  });

  it('clamps an absurd limit', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    await get('http://localhost/api/admin/digests?limit=9999');
    expect(mockList).toHaveBeenCalledWith(100, 0);
  });

  it('falls back to the default on a non-numeric limit', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    await get('http://localhost/api/admin/digests?limit=abc');
    expect(mockList).toHaveBeenCalledWith(20, 0);
  });
});
