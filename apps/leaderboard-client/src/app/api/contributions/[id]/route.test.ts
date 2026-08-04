import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindById, mockVerifyRequestToken } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  ContributionRepository: class {
    findById = mockFindById;
  },
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

import { GET } from './route';

const CONTRIBUTION_ID = 'contribution-1';

function getContribution() {
  const req = new NextRequest(`http://localhost/api/contributions/${CONTRIBUTION_ID}`);
  return GET(req, { params: Promise.resolve({ id: CONTRIBUTION_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue(null);
});

describe('GET /api/contributions/[id]', () => {
  it('returns 404 when the contribution does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await getContribution();

    expect(res.status).toBe(404);
  });

  it('returns the full contribution (with evaluation) to its author', async () => {
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'u1', evaluation: { score: 90 } });
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });

    const res = await getContribution();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.evaluation).toEqual({ score: 90 });
  });

  it('strips the evaluation for a different logged-in user', async () => {
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'u1', evaluation: { score: 90 } });
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u2', role: 'contributor', email: 'b@b.com' });

    const res = await getContribution();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.evaluation).toBeNull();
  });

  it('strips the evaluation for an anonymous (unauthenticated) request', async () => {
    mockFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'u1', evaluation: { score: 90 } });
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await getContribution();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.evaluation).toBeNull();
  });

  it('returns 500 when the repository call throws', async () => {
    mockFindById.mockRejectedValue(new Error('db down'));

    const res = await getContribution();

    expect(res.status).toBe(500);
  });
});
