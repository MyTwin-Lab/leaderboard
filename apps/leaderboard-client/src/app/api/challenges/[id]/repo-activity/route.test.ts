import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateConnector, mockVerifyRequestToken, mockToPublic } = vi.hoisted(() => ({
  mockCreateConnector: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
  mockToPublic: vi.fn((payload: any) => ({ events: payload.events.filter((e: any) => e.type !== 'branch_created') })),
}));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepoRepository: class {
    async findByChallengeWithRepo() {
      return [
        { repo_id: 'repo-1', repo_type: 'github', repo_external_id: 'owner/repo', title: 'Test Repo', type: 'github' },
        { repo_id: 'repo-2', repo_type: 'kaggle_dataset', repo_external_id: 'owner/data', title: 'Data', type: 'kaggle_dataset' },
        { repo_id: 'repo-3', repo_type: 'kaggle_model', repo_external_id: null, title: 'Model', type: 'kaggle_model',
          workspace_meta: { userUrls: { u1: 'https://www.kaggle.com/models/alice/a', u2: 'https://www.kaggle.com/models/bob/b' } } },
      ];
    }
  },
  // Instantiated at module scope by the route, which loads it to check whether
  // an unpublished challenge is being reached without a session.
  ChallengeRepository: class {
    async findById() {
      return { uuid: 'challenge-1', status: 'active', type: 'code' };
    }
  },
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock('@/lib/public/challengeVisibility', () => ({ isPubliclyVisible: () => true }));

const GITHUB = { key: 'github', repoTypes: ['github'], activity: { toPublic: mockToPublic } };
const KAGGLE = {
  key: 'kaggle',
  repoTypes: ['kaggle_dataset', 'kaggle_model'],
  activity: { repoTypes: ['kaggle_model'], merge: (payloads: any[]) => ({ kind: 'model', merged: payloads.length }) },
};

vi.mock('../../../../../../../../packages/connectors/registry.js', () => ({
  ConnectorRegistry: {
    createConnector: (...args: unknown[]) => mockCreateConnector(...args),
    definitionFor: (type: string) => [GITHUB, KAGGLE].find(d => d.repoTypes.includes(type)),
    get: (key: string) => [GITHUB, KAGGLE].find(d => d.key === key),
  },
}));

import { GET } from './route';
import { NextRequest } from 'next/server';

const EVENTS = [
  { type: 'commit', id: 'abc123', title: 'Initial commit' },
  { type: 'branch_created', id: 'branch-contrib', title: 'contrib/3-alice' },
];

async function getActivities() {
  const req = new NextRequest('http://localhost/api/challenges/challenge-1/repo-activity');
  const res = await GET(req, { params: Promise.resolve({ id: 'challenge-1' }) });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'admin' });
  mockCreateConnector.mockImplementation(async (repo: any) => ({
    fetchRepoActivity: async () =>
      repo.type === 'github'
        ? { connectorKey: 'github', payload: { events: EVENTS } }
        : { connectorKey: 'kaggle', payload: { kind: 'model', ref: repo.external_repo_id } },
  }));
});

describe('GET /api/challenges/[id]/repo-activity', () => {
  it('returns each activity keyed by repo_id, in its connector envelope', async () => {
    const { status, body } = await getActivities();

    expect(status).toBe(200);
    expect(body.activities['repo-1']).toEqual({ connectorKey: 'github', payload: { events: EVENTS } });
  });

  it('skips repo types the connector declares without activity', async () => {
    const { body } = await getActivities();

    expect(body.activities['repo-2']).toEqual({ error: 'No activity method available' });
  });

  it("merges the activity of every contributor's artifact through the connector", async () => {
    const { body } = await getActivities();

    expect(body.activities['repo-3']).toEqual({ connectorKey: 'kaggle', payload: { kind: 'model', merged: 2 } });
  });

  it('returns error entry when connector has no fetchRepoActivity', async () => {
    mockCreateConnector.mockResolvedValue({});

    const { body } = await getActivities();

    expect(body.activities['repo-1'].error).toBeDefined();
  });

  it("applies the connector's public filter for an anonymous visitor", async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const { body } = await getActivities();

    expect(mockToPublic).toHaveBeenCalled();
    expect(body.activities['repo-1'].payload.events.map((e: any) => e.type)).toEqual(['commit']);
  });
});
