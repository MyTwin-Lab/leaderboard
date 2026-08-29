import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyAdmin, mockGet } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    get = mockGet;
  },
}));

import { GET } from './route';

function getStatus() {
  const req = new NextRequest('http://localhost/api/github-oauth/status');
  return GET(req);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/github-oauth/status', () => {
  it('returns 401 when the caller is not an admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);

    const res = await getStatus();

    expect(res.status).toBe(401);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns the connection status for an admin, formatting the timestamp as ISO', async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
    mockGet.mockResolvedValue({
      github_is_connected: true,
      github_org: 'MyTwin-Lab',
      github_connected_at: new Date('2026-07-10T00:00:00Z'),
    });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: true,
      org: 'MyTwin-Lab',
      connected_at: '2026-07-10T00:00:00.000Z',
    });
  });

  it('falls back to null org/connected_at when not set', async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
    mockGet.mockResolvedValue({
      github_is_connected: false,
      github_org: null,
      github_connected_at: null,
    });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      org: null,
      connected_at: null,
    });
  });
});
