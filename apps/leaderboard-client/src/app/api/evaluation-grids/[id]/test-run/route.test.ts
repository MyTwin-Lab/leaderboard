import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyAdmin,
  mockFindFullById,
  mockConvertGridToEvaluatorFormat,
  mockAggregateItems,
  mockPrepareBundle,
  mockReleaseBundle,
  mockParseGitHubUrl,
  mockResolveGitHubCommitShas,
  mockExtractArtifactRef,
  mockCreateConnector,
  mockGithubConnect,
  mockGetGithubToken,
  mockKaggleConnect,
  mockKaggleFetchItems,
  mockKaggleFetchItemContent,
  mockEvaluate,
} = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockFindFullById: vi.fn(),
  mockConvertGridToEvaluatorFormat: vi.fn(),
  mockAggregateItems: vi.fn(),
  mockPrepareBundle: vi.fn(),
  mockReleaseBundle: vi.fn(),
  mockParseGitHubUrl: vi.fn(),
  mockResolveGitHubCommitShas: vi.fn(),
  mockExtractArtifactRef: vi.fn(),
  mockCreateConnector: vi.fn(),
  mockGithubConnect: vi.fn(),
  mockGetGithubToken: vi.fn(),
  mockKaggleConnect: vi.fn(),
  mockKaggleFetchItems: vi.fn(),
  mockKaggleFetchItemContent: vi.fn(),
  mockEvaluate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../../packages/database-service/repositories/evaluationGrids.repo.js', () => ({
  EvaluationGridsRepository: class {
    findFullById = mockFindFullById;
  },
}));

vi.mock('../../../../../../../../packages/services/database-grid-provider.js', () => ({
  convertGridToEvaluatorFormat: mockConvertGridToEvaluatorFormat,
}));

vi.mock('../../../../../../../../packages/capabilities/bundle.js', () => ({
  aggregateItems: mockAggregateItems,
  prepareBundle: mockPrepareBundle,
  releaseBundle: mockReleaseBundle,
}));

vi.mock('../../../../../../../../packages/services/challenge/githubUrl.js', () => ({
  parseGitHubUrl: mockParseGitHubUrl,
  resolveGitHubCommitShas: mockResolveGitHubCommitShas,
}));

vi.mock('../../../../../../../../packages/services/challenge/artifactUrl.js', () => ({
  extractArtifactRef: mockExtractArtifactRef,
}));

vi.mock('../../../../../../../../packages/connectors/registry.js', () => ({
  ConnectorRegistry: { createConnector: mockCreateConnector },
}));

vi.mock('../../../../../../../../packages/config/githubToken.js', () => ({
  getGithubToken: mockGetGithubToken,
}));

vi.mock('../../../../../../../../packages/evaluator/evaluator.js', () => ({
  OpenAIAgentEvaluator: class {
    evaluate = mockEvaluate;
  },
}));

import { POST } from './route';

const GRID_ID = 'grid-1';

function postTestRun(body: unknown) {
  const req = new NextRequest(`http://localhost/api/evaluation-grids/${GRID_ID}/test-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: GRID_ID }) });
}

const GITHUB_BODY = { sourceType: 'github', sourceUrl: 'https://github.com/acme/widgets' };
const KAGGLE_BODY = { sourceType: 'kaggle_dataset', sourceUrl: 'https://kaggle.com/datasets/acme/widgets' };

const GRID_WITH_CATEGORIES = {
  uuid: GRID_ID,
  slug: 'code-review',
  categories: [{ uuid: 'cat-1', name: 'Correctness' }],
};

const evaluation = (globalScore: number) => ({
  globalScore,
  scores: [{ criterion: 'Correctness', score: globalScore }],
});

const githubConnector = () => ({ connect: mockGithubConnect });
const kaggleConnector = () => ({
  connect: mockKaggleConnect,
  fetchItems: mockKaggleFetchItems,
  fetchItemContent: mockKaggleFetchItemContent,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockFindFullById.mockResolvedValue(GRID_WITH_CATEGORIES);
  mockConvertGridToEvaluatorFormat.mockReturnValue({ slug: 'code-review', categories: [] });
  mockPrepareBundle.mockResolvedValue({ commitShas: ['sha1'], workspacePath: '/tmp/workspace' });
  mockReleaseBundle.mockResolvedValue(undefined);
  mockEvaluate.mockResolvedValue(evaluation(80));

  mockCreateConnector.mockImplementation(async (repo: { type: string }) =>
    repo.type === 'github' ? githubConnector() : kaggleConnector()
  );

  mockParseGitHubUrl.mockReturnValue({ owner: 'acme', repo: 'widgets', refType: 'branch', ref: 'main' });
  mockGetGithubToken.mockResolvedValue('gh-token');
  mockGithubConnect.mockResolvedValue(undefined);
  mockResolveGitHubCommitShas.mockResolvedValue(['sha1']);
  mockAggregateItems.mockResolvedValue({ commitSha: 'sha1', modifiedFiles: [] });

  mockExtractArtifactRef.mockReturnValue('acme/widgets');
  mockKaggleConnect.mockResolvedValue(undefined);
  mockKaggleFetchItems.mockResolvedValue([{ id: 'item-1' }]);
  mockKaggleFetchItemContent.mockResolvedValue({ commitSha: 'sha1', modifiedFiles: [] });
});

describe('POST /api/evaluation-grids/[id]/test-run', () => {
  it('returns 403 when not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(403);
    expect(mockFindFullById).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postTestRun({ sourceType: 'not-a-valid-source', sourceUrl: 'x' });

    expect(res.status).toBe(400);
    expect(mockFindFullById).not.toHaveBeenCalled();
  });

  it('returns 404 when the grid does not exist', async () => {
    mockFindFullById.mockResolvedValue(null);

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(404);
  });

  it('returns 400 when the grid has no categories', async () => {
    mockFindFullById.mockResolvedValue({ ...GRID_WITH_CATEGORIES, categories: [] });

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one category/i);
  });

  it('runs the grid 5 times against a GitHub source and returns aggregated results', async () => {
    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(200);
    expect(mockCreateConnector).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'github', external_repo_id: 'acme/widgets' }),
      { branch: 'main', allowAnonymous: true }
    );
    expect(mockResolveGitHubCommitShas).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'acme', repo: 'widgets' }),
      expect.objectContaining({ connect: mockGithubConnect }),
      20
    );
    expect(mockEvaluate).toHaveBeenCalledTimes(5);
    const body = await res.json();
    expect(body.runs).toHaveLength(5);
    expect(body.failedCount).toBe(0);
    expect(body.determinism).toEqual({ score: 100, mean: 80, stddev: 0 });
    expect(body.perCriterion).toEqual([
      { criterion: 'Correctness', mean: 80, stddev: 0, values: [80, 80, 80, 80, 80] },
    ]);
    expect(body.warning).toBeUndefined();
    expect(mockReleaseBundle).toHaveBeenCalledWith(expect.objectContaining({ workspacePath: '/tmp/workspace' }));
  });

  it('adds a rate-limit warning when no GitHub token is configured', async () => {
    mockGetGithubToken.mockResolvedValue(null);

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warning).toMatch(/without a GitHub token \(none configured\)/i);
  });

  it('returns 400 when the GitHub URL cannot be parsed', async () => {
    mockParseGitHubUrl.mockReturnValue(null);

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(400);
    expect(mockCreateConnector).not.toHaveBeenCalled();
    expect(mockGithubConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when no GitHub connector is installed', async () => {
    mockCreateConnector.mockResolvedValue(null);

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/GitHub connector/i);
  });

  it('returns 400 when no commits are found for the GitHub reference', async () => {
    mockResolveGitHubCommitShas.mockResolvedValue([]);

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no commits found/i);
  });

  it('returns 400 with a token hint when connecting to GitHub fails without a token', async () => {
    mockGetGithubToken.mockResolvedValue(null);
    mockGithubConnect.mockRejectedValue(new Error('rate limited'));

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/rate limited/);
    expect(body.error).toMatch(/no GitHub token configured/i);
  });

  it('runs the grid against a Kaggle source and returns aggregated results', async () => {
    const res = await postTestRun(KAGGLE_BODY);

    expect(res.status).toBe(200);
    expect(mockCreateConnector).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'kaggle_dataset', external_repo_id: 'acme/widgets' })
    );
    expect(mockKaggleFetchItemContent).toHaveBeenCalledWith('item-1');
    const body = await res.json();
    expect(body.runs).toHaveLength(5);
  });

  it('returns 400 when the Kaggle URL cannot be parsed', async () => {
    mockExtractArtifactRef.mockReturnValue(undefined);

    const res = await postTestRun(KAGGLE_BODY);

    expect(res.status).toBe(400);
  });

  it('returns 400 when no Kaggle credentials are configured', async () => {
    mockCreateConnector.mockImplementation(async (repo: { type: string }) =>
      repo.type === 'github' ? githubConnector() : null
    );

    const res = await postTestRun(KAGGLE_BODY);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no Kaggle credentials configured/i);
  });

  it('returns 400 when nothing is found at the Kaggle URL', async () => {
    mockKaggleFetchItems.mockResolvedValue([]);

    const res = await postTestRun(KAGGLE_BODY);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/nothing found/i);
  });

  it('returns 502 when every evaluation run fails', async () => {
    mockEvaluate.mockRejectedValue(new Error('evaluator crashed'));

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(502);
  });

  it('returns 500 when an unexpected error is thrown', async () => {
    mockFindFullById.mockRejectedValue(new Error('db down'));

    const res = await postTestRun(GITHUB_BODY);

    expect(res.status).toBe(500);
  });
});
