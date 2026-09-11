import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockSearchByName, mockFindByChallenge } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockSearchByName: vi.fn(),
  mockFindByChallenge: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class { searchByName = mockSearchByName; },
  ChallengeTeamRepository: class { findByChallenge = mockFindByChallenge; },
}));

import { GET } from './route';

function search(qs: string) {
  return GET(new NextRequest(`http://localhost/api/contributors/search${qs}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
  mockFindByChallenge.mockResolvedValue([]);
  mockSearchByName.mockResolvedValue([]);
});

describe('GET /api/contributors/search', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await search('?q=cam')).status).toBe(401);
  });

  it('returns nothing for a term under two characters, without querying', async () => {
    const res = await search('?q=c');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
    expect(mockSearchByName).not.toHaveBeenCalled();
  });

  it('never leaks email or google_user_id', async () => {
    // La raison d'être de cette route : `GET /api/users` rend les rows
    // entières, email compris.
    mockSearchByName.mockResolvedValue([
      {
        uuid: 'user-2', full_name: 'Camille Daverio', avatar_url: null,
        email: 'c@example.com', google_user_id: 'g-1', github_username: 'Inarinokaze',
      },
    ]);

    const body = await (await search('?q=cam')).json();

    expect(body.results).toEqual([
      { uuid: 'user-2', full_name: 'Camille Daverio', avatar_url: null, blocked_reason: null },
    ]);
  });

  it('excludes the caller from their own results', async () => {
    mockSearchByName.mockResolvedValue([
      { uuid: 'user-1', full_name: 'Camille Daverio', avatar_url: null },
      { uuid: 'user-2', full_name: 'Camille Dupont', avatar_url: null },
    ]);

    const body = await (await search('?q=cam')).json();

    expect(body.results.map((r: { uuid: string }) => r.uuid)).toEqual(['user-2']);
  });

  it('marks a contributor already on the challenge rather than hiding them', async () => {
    mockSearchByName.mockResolvedValue([
      { uuid: 'user-2', full_name: 'Patricia Novi', avatar_url: null },
    ]);
    mockFindByChallenge.mockResolvedValue([{ user_id: 'user-2' }]);

    const body = await (await search('?q=pat&challenge=challenge-1')).json();

    expect(body.results).toEqual([
      {
        uuid: 'user-2', full_name: 'Patricia Novi', avatar_url: null,
        blocked_reason: 'already_member',
      },
    ]);
  });

  it('does not look up participants when no challenge is passed', async () => {
    mockSearchByName.mockResolvedValue([
      { uuid: 'user-2', full_name: 'Patricia Novi', avatar_url: null },
    ]);

    await search('?q=pat');

    expect(mockFindByChallenge).not.toHaveBeenCalled();
  });

  it('caps the page at ten, asking for one extra to absorb the caller', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      uuid: `user-${i + 2}`, full_name: `Contributor ${i}`, avatar_url: null,
    }));
    mockSearchByName.mockResolvedValue(many);

    const body = await (await search('?q=con')).json();

    expect(mockSearchByName).toHaveBeenCalledWith('con', 11);
    expect(body.results).toHaveLength(10);
  });
});
