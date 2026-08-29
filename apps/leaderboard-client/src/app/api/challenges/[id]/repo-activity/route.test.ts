import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepoRepository: class {
    async findByChallengeWithRepo() {
      return [
        {
          repo_id: 'repo-1',
          repo_type: 'github',
          external_repo_id: 'owner/repo',
          title: 'Test Repo',
          type: 'github',
        },
      ];
    }
  },
}));

const mockCreateConnector = vi.fn(() => ({
  fetchRepoActivity: async () => ({
    type: 'github',
    events: [
      {
        type: 'commit',
        id: 'abc123',
        title: 'Initial commit',
        author: 'alice',
        date: '2026-01-01T00:00:00Z',
        url: 'https://github.com/owner/repo/commit/abc123',
        metadata: {},
      },
    ],
  }),
}));

vi.mock('../../../../../../../../packages/connectors/registry.js', () => ({
  ConnectorRegistry: {
    get createConnector() { return mockCreateConnector; },
  },
}));

import { GET } from './route';
import { NextRequest } from 'next/server';

describe('GET /api/challenges/[id]/repo-activity', () => {
  it('returns activities keyed by repo_id with github type', async () => {
    const req = new NextRequest('http://localhost/api/challenges/challenge-1/repo-activity');
    const res = await GET(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toBeDefined();
    expect(body.activities['repo-1']).toBeDefined();
    expect(body.activities['repo-1'].type).toBe('github');
  });

  it('returns error entry when connector has no fetchRepoActivity', async () => {
    mockCreateConnector.mockReturnValueOnce({} as any);

    const req = new NextRequest('http://localhost/api/challenges/challenge-1/repo-activity');
    const res = await GET(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities['repo-1'].error).toBeDefined();
  });
});
