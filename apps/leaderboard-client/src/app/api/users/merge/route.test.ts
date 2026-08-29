import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockMerge } = vi.hoisted(() => ({
  mockMerge: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  AccountMergeRepository: class {
    merge = mockMerge;
  },
}));

import { POST } from './route';

const PLACEHOLDER_ID = '11111111-1111-4111-8111-111111111111';
const GOOGLE_ID = '22222222-2222-4222-8222-222222222222';

function postMerge(body: unknown) {
  const req = new NextRequest('http://localhost/api/users/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/users/merge', () => {
  it('merges the two accounts and returns the updated placeholder', async () => {
    const merged = { uuid: PLACEHOLDER_ID, full_name: 'Ada Lovelace', google_user_id: 'g-123', email: 'ada@example.com' };
    mockMerge.mockResolvedValue(merged);

    const res = await postMerge({ placeholderId: PLACEHOLDER_ID, googleAccountId: GOOGLE_ID });

    expect(res.status).toBe(200);
    expect(mockMerge).toHaveBeenCalledWith(PLACEHOLDER_ID, GOOGLE_ID);
    expect(await res.json()).toEqual(merged);
  });

  it('returns 400 on an invalid body (Zod)', async () => {
    const res = await postMerge({ placeholderId: 'not-a-uuid', googleAccountId: GOOGLE_ID });

    expect(res.status).toBe(400);
    expect(mockMerge).not.toHaveBeenCalled();
  });

  it('returns 400 with the repository error message when the merge fails', async () => {
    mockMerge.mockRejectedValue(new Error('Placeholder already has a Google account linked'));

    const res = await postMerge({ placeholderId: PLACEHOLDER_ID, googleAccountId: GOOGLE_ID });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Placeholder already has a Google account linked');
  });
});
