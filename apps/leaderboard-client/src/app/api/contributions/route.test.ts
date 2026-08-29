import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindAll, mockCreate } = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  ContributionRepository: class {
    findAll = mockFindAll;
    create = mockCreate;
  },
}));

import { GET, POST } from './route';

function postContribution(body: unknown) {
  const req = new Request('http://localhost/api/contributions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'My contribution',
    type: 'code',
    user_id: 'user-1',
    challenge_id: 'challenge-1',
    reward: 10,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/contributions', () => {
  it('returns all contributions', async () => {
    const contributions = [{ uuid: 'c1', title: 'A' }];
    mockFindAll.mockResolvedValue(contributions);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(contributions);
  });

  it('returns 500 when the repository throws', async () => {
    mockFindAll.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch contributions');
  });
});

describe('POST /api/contributions', () => {
  it('creates a contribution and returns 201', async () => {
    const created = { uuid: 'c1', title: 'My contribution' };
    mockCreate.mockResolvedValue(created);

    const res = await postContribution(validBody({ description: 'desc', task_id: 'task-1' }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.title).toBe('My contribution');
    expect(call.type).toBe('code');
    expect(call.user_id).toBe('user-1');
    expect(call.challenge_id).toBe('challenge-1');
    expect(call.reward).toBe(10);
    expect(call.description).toBe('desc');
    expect(call.task_id).toBe('task-1');
    expect(call.submitted_at).toBeInstanceOf(Date);
  });

  it('defaults description, evaluation and task_id when omitted', async () => {
    mockCreate.mockResolvedValue({ uuid: 'c1' });

    await postContribution(validBody());

    const call = mockCreate.mock.calls[0][0];
    expect(call.description).toBeUndefined();
    expect(call.evaluation).toEqual({});
    expect(call.task_id).toBeUndefined();
  });

  it('returns 400 when a required field is missing', async () => {
    const res = await postContribution(validBody({ title: undefined }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing required fields/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when reward is undefined', async () => {
    const res = await postContribution(validBody({ reward: undefined }));

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid contribution type', async () => {
    const res = await postContribution(validBody({ type: 'invalid-type' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid type/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 500 when creation fails', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    const res = await postContribution(validBody());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to create contribution');
  });
});
