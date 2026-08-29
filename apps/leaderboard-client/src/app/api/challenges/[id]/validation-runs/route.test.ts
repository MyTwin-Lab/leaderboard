import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockFindByChallenge, mockChallengeFindById, mockContributionFindById, mockUserFindByIds } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockFindByChallenge: vi.fn(),
  mockChallengeFindById: vi.fn(),
  mockContributionFindById: vi.fn(),
  mockUserFindByIds: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockChallengeFindById; },
  ContributionRepository: class { findById = mockContributionFindById; },
  ValidationAttemptRepository: class { findByChallenge = mockFindByChallenge; },
  UserRepository: class { findByIds = mockUserFindByIds; },
}));

import { GET } from './route';

const CHALLENGE_ID = 'challenge-1';

function makeRequest() {
  return new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-runs`);
}

function callGet() {
  return GET(makeRequest(), { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation' });
  mockFindByChallenge.mockResolvedValue([]);
  mockUserFindByIds.mockResolvedValue([]);
});

describe('GET /api/challenges/[id]/validation-runs', () => {
  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it('returns 403 when neither admin nor manager of this challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);
    const res = await callGet();
    expect(res.status).toBe(403);
  });

  it('allows a manager of the challenge (not just admins)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(true);
    const res = await callGet();
    expect(res.status).toBe(200);
  });

  it('returns 404 when the challenge does not exist', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockChallengeFindById.mockResolvedValue(null);
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  it('returns 400 when the challenge is not a validation challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'ml' });
    const res = await callGet();
    expect(res.status).toBe(400);
  });

  it('maps runs with resolved submitter/validator names, description, and purged flag', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockFindByChallenge.mockResolvedValue([
      {
        uuid: 'attempt-1',
        contribution_id: 'contrib-1',
        validator_user_id: 'validator-1',
        verdict: 'broken',
        description: 'It crashed',
        created_at: new Date('2026-01-01T00:00:00Z'),
        file_filename: 'cat.png',
        file_content_type: 'image/png',
        response_content_type: 'application/json',
        response_status: 500,
        purged_at: null,
      },
      {
        uuid: 'attempt-2',
        contribution_id: 'contrib-1',
        validator_user_id: 'validator-2',
        verdict: 'works',
        description: null,
        created_at: new Date('2026-01-02T00:00:00Z'),
        file_filename: 'dog.png',
        file_content_type: 'image/png',
        response_content_type: 'application/json',
        response_status: 200,
        purged_at: new Date('2026-02-01T00:00:00Z'),
      },
    ]);
    mockContributionFindById.mockResolvedValue({ uuid: 'contrib-1', user_id: 'submitter-1' });
    mockUserFindByIds.mockResolvedValue([
      { uuid: 'submitter-1', full_name: 'Alice' },
      { uuid: 'validator-1', full_name: 'Bob' },
      { uuid: 'validator-2', full_name: 'Carol' },
    ]);

    const res = await callGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runs).toHaveLength(2);

    const brokenRun = body.runs.find((r: any) => r.id === 'attempt-1');
    expect(brokenRun).toMatchObject({
      submitterName: 'Alice',
      validatorName: 'Bob',
      verdict: 'broken',
      description: 'It crashed',
      purged: false,
    });

    const worksRun = body.runs.find((r: any) => r.id === 'attempt-2');
    expect(worksRun).toMatchObject({
      submitterName: 'Alice',
      validatorName: 'Carol',
      verdict: 'works',
      description: null,
      purged: true,
    });
  });

  it('never includes file_bytes/response_bytes fields in the response (list is metadata-only)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockFindByChallenge.mockResolvedValue([
      {
        uuid: 'attempt-1',
        contribution_id: 'contrib-1',
        validator_user_id: 'validator-1',
        verdict: 'works',
        description: null,
        created_at: new Date(),
        file_filename: 'cat.png',
        file_content_type: 'image/png',
        response_content_type: 'application/json',
        response_status: 200,
        purged_at: null,
      },
    ]);
    mockContributionFindById.mockResolvedValue({ uuid: 'contrib-1', user_id: 'submitter-1' });

    const res = await callGet();
    const body = await res.json();

    expect(body.runs[0]).not.toHaveProperty('fileBytes');
    expect(body.runs[0]).not.toHaveProperty('responseBytes');
    expect(JSON.stringify(body.runs[0])).not.toMatch(/bytes/i);
  });
});
