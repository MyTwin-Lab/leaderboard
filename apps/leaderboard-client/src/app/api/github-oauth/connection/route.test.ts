import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockClearGithubConnection } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockClearGithubConnection: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    clearGithubConnection = mockClearGithubConnection;
  },
}));

import { DELETE } from './route';

function deleteConnection() {
  const req = new NextRequest('http://localhost/api/github-oauth/connection', { method: 'DELETE' });
  return DELETE(req);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/github-oauth/connection', () => {
  it('returns 401 when not admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    const res = await deleteConnection();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Admin only');
    expect(mockClearGithubConnection).not.toHaveBeenCalled();
  });

  it('clears the GitHub connection and returns ok:true when admin', async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
    mockClearGithubConnection.mockResolvedValue(undefined);

    const res = await deleteConnection();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockClearGithubConnection).toHaveBeenCalledTimes(1);
  });
});
