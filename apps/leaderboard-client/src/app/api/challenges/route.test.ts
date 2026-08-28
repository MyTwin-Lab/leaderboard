import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockJwtVerify, mockChallengeFindAll, mockChallengeFindById, mockChallengeCreate,
  mockRepoCreate, mockChallengeRepoCreate, mockProjectFindByManagerId, mockProjectFindById,
} = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockChallengeFindAll: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockChallengeCreate: vi.fn(),
  mockRepoCreate: vi.fn(),
  mockChallengeRepoCreate: vi.fn(),
  mockProjectFindByManagerId: vi.fn(),
  mockProjectFindById: vi.fn(),
}));

vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class {
    findAll = mockChallengeFindAll;
    findById = mockChallengeFindById;
    create = mockChallengeCreate;
  },
  RepoRepository: class {
    create = mockRepoCreate;
  },
  ChallengeRepoRepository: class {
    create = mockChallengeRepoCreate;
  },
}));

vi.mock('@/lib/db', () => ({
  repositories: {
    project: {
      findByManagerId: mockProjectFindByManagerId,
      findById: mockProjectFindById,
    },
  },
}));

import { GET, POST } from './route';

function getChallenges(query = '', token?: string) {
  const req = new NextRequest(`http://localhost/api/challenges${query}`, {
    headers: token ? { cookie: `access_token=${token}` } : undefined,
  });
  return GET(req);
}

function postChallenge(body: unknown, token?: string) {
  const req = new NextRequest('http://localhost/api/challenges', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { cookie: `access_token=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return POST(req);
}

const validBody = {
  title: 'New Challenge',
  status: 'draft',
  type: 'code',
  contribution_points_reward: 100,
  project_id: '11111111-1111-4111-8111-111111111111',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockChallengeFindAll.mockResolvedValue([]);
  mockChallengeCreate.mockImplementation(async (data: any) => ({ uuid: 'new-challenge', ...data }));
  mockRepoCreate.mockImplementation(async (data: any) => ({ uuid: `repo-${data.title}`, ...data }));
  mockChallengeRepoCreate.mockResolvedValue({});
  mockProjectFindByManagerId.mockResolvedValue([]);
  mockProjectFindById.mockResolvedValue({ uuid: validBody.project_id, manager_id: 'manager-1' });
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'admin-1', role: 'admin' } });
});

describe('GET /api/challenges', () => {
  it('returns all challenges when "managed" is not requested', async () => {
    mockChallengeFindAll.mockResolvedValue([{ uuid: 'c1' }, { uuid: 'c2' }]);

    const res = await getChallenges();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([{ uuid: 'c1' }, { uuid: 'c2' }]);
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it('returns 401 for managed=true without a token', async () => {
    const res = await getChallenges('?managed=true');

    expect(res.status).toBe(401);
  });

  it('filters challenges to those under the manager\'s projects for managed=true', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'manager-1', role: 'manager' } });
    mockProjectFindByManagerId.mockResolvedValue([{ uuid: 'p1' }]);
    mockChallengeFindAll.mockResolvedValue([
      { uuid: 'c1', project_id: 'p1' },
      { uuid: 'c2', project_id: 'p2' },
    ]);

    const res = await getChallenges('?managed=true', 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([{ uuid: 'c1', project_id: 'p1' }]);
    expect(mockProjectFindByManagerId).toHaveBeenCalledWith('manager-1');
  });

  it('returns 401 when an invalid token throws during managed=true', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad token'));

    const res = await getChallenges('?managed=true', 'garbage');

    expect(res.status).toBe(401);
  });

  it('returns 500 when the repository call throws', async () => {
    mockChallengeFindAll.mockRejectedValue(new Error('db down'));

    const res = await getChallenges();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/challenges', () => {
  it('returns 401 without a token', async () => {
    const res = await postChallenge(validBody);

    expect(res.status).toBe(401);
    expect(mockChallengeCreate).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postChallenge({ title: '' }, 'valid-token');

    expect(res.status).toBe(400);
    expect(mockChallengeCreate).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-admin does not manage the target project', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'someone-else', role: 'manager' } });

    const res = await postChallenge(validBody, 'valid-token');

    expect(res.status).toBe(403);
  });

  it('returns 403 when the target project does not exist for a non-admin', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'manager-1', role: 'manager' } });
    mockProjectFindById.mockResolvedValue(null);

    const res = await postChallenge(validBody, 'valid-token');

    expect(res.status).toBe(403);
  });

  it('allows a manager who owns the target project', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'manager-1', role: 'manager' } });

    const res = await postChallenge(validBody, 'valid-token');

    expect(res.status).toBe(201);
  });

  it('creates a "code" challenge with a single linked repo', async () => {
    const res = await postChallenge(validBody, 'valid-token');
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.uuid).toBe('new-challenge');
    expect(mockRepoCreate).toHaveBeenCalledTimes(1);
    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Challenge — Code', type: 'github', project_id: validBody.project_id })
    );
    expect(mockChallengeRepoCreate).toHaveBeenCalledTimes(1);
  });

  it('parses a full GitHub URL into an owner/repo slug', async () => {
    await postChallenge({ ...validBody, github_repo: 'https://github.com/acme/widgets.git' }, 'valid-token');

    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ external_repo_id: 'acme/widgets' })
    );
  });

  it('creates an "ml" challenge with four role-tagged repos', async () => {
    const res = await postChallenge({ ...validBody, type: 'ml' }, 'valid-token');

    expect(res.status).toBe(201);
    expect(mockRepoCreate).toHaveBeenCalledTimes(4);
    expect(mockChallengeRepoCreate).toHaveBeenCalledTimes(4);
    const roles = mockChallengeRepoCreate.mock.calls.map(([args]: any[]) => args.role);
    expect(roles.sort()).toEqual(['api', 'dataset', 'model', 'model_code']);
  });

  it('skips the API repo when api_packaging_enabled is false, leaving only dataset/model/model_code', async () => {
    const res = await postChallenge({ ...validBody, type: 'ml', api_packaging_enabled: false }, 'valid-token');

    expect(res.status).toBe(201);
    expect(mockRepoCreate).toHaveBeenCalledTimes(3);
    expect(mockChallengeRepoCreate).toHaveBeenCalledTimes(3);
    const roles = mockChallengeRepoCreate.mock.calls.map(([args]: any[]) => args.role);
    expect(roles.sort()).toEqual(['dataset', 'model', 'model_code']);
  });

  describe('validation challenge business rules', () => {
    const mlSourceId = '22222222-2222-4222-8222-222222222222';

    beforeEach(() => {
      mockChallengeFindById.mockResolvedValue({ uuid: mlSourceId, type: 'ml' });
    });

    function validationBody(overrides: Record<string, unknown> = {}) {
      return {
        ...validBody,
        type: 'validation',
        source_challenge_id: mlSourceId,
        cp_per_validation: 5,
        required_validations: 3,
        ...overrides,
      };
    }

    it('requires source_challenge_id', async () => {
      const res = await postChallenge(validationBody({ source_challenge_id: undefined }), 'valid-token');
      expect(res.status).toBe(400);
    });

    it('requires cp_per_validation', async () => {
      const res = await postChallenge(validationBody({ cp_per_validation: undefined }), 'valid-token');
      expect(res.status).toBe(400);
    });

    it('requires required_validations', async () => {
      const res = await postChallenge(validationBody({ required_validations: undefined }), 'valid-token');
      expect(res.status).toBe(400);
    });

    it('rejects an even required_validations', async () => {
      const res = await postChallenge(validationBody({ required_validations: 4 }), 'valid-token');
      expect(res.status).toBe(400);
    });

    it('rejects a source_challenge_id that does not reference an ML challenge', async () => {
      mockChallengeFindById.mockResolvedValue({ uuid: mlSourceId, type: 'code' });

      const res = await postChallenge(validationBody(), 'valid-token');

      expect(res.status).toBe(400);
    });

    it('rejects a source_challenge_id that does not exist', async () => {
      mockChallengeFindById.mockResolvedValue(null);

      const res = await postChallenge(validationBody(), 'valid-token');

      expect(res.status).toBe(400);
    });

    it('returns 409 when the ML challenge already has a linked validation challenge', async () => {
      mockChallengeFindAll.mockResolvedValue([
        { uuid: 'existing-validation', type: 'validation', source_challenge_id: mlSourceId },
      ]);

      const res = await postChallenge(validationBody(), 'valid-token');

      expect(res.status).toBe(409);
    });

    it('creates the validation challenge on success, with no repos', async () => {
      const res = await postChallenge(validationBody(), 'valid-token');
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(mockRepoCreate).not.toHaveBeenCalled();
      expect(mockChallengeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source_challenge_id: mlSourceId,
          cp_per_validation: 5,
          required_validations: 3,
        })
      );
    });
  });

  it('returns 401 when an invalid token throws', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad token'));

    const res = await postChallenge(validBody, 'garbage');

    expect(res.status).toBe(401);
  });

  describe('workspace_mode', () => {
    it('creates no repo for a "code" challenge with workspace_mode "own_repo"', async () => {
      const res = await postChallenge({ ...validBody, workspace_mode: 'own_repo' }, 'valid-token');
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(mockRepoCreate).not.toHaveBeenCalled();
      expect(mockChallengeCreate).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_mode: 'own_repo' })
      );
      expect(body.workspace_mode).toBe('own_repo');
    });

    it('creates the GitHub repo for a "code" challenge without workspace_mode (historical behavior), defaulting to provided_repo', async () => {
      const res = await postChallenge(validBody, 'valid-token');
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(mockRepoCreate).toHaveBeenCalledTimes(1);
      expect(mockChallengeCreate).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_mode: 'provided_repo' })
      );
      expect(body.workspace_mode).toBe('provided_repo');
    });

    it('accepts code reward_rules on a "code" challenge', async () => {
      const res = await postChallenge(
        { ...validBody, reward_rules: { version: 1, delivery: { fixed: 50, cap: 150 } } },
        'valid-token'
      );

      expect(res.status).toBe(201);
    });

    it('returns 400 when reward_rules matches neither the ml nor the code shape', async () => {
      const res = await postChallenge({ ...validBody, reward_rules: { foo: 1 } }, 'valid-token');
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid reward_rules');
      expect(mockChallengeCreate).not.toHaveBeenCalled();
    });
  });

  it('returns 500 when challenge creation fails', async () => {
    mockChallengeCreate.mockRejectedValue(new Error('db down'));

    const res = await postChallenge(validBody, 'valid-token');

    expect(res.status).toBe(500);
  });
});
