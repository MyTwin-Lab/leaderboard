import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGet, mockVerifyAdmin } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockVerifyAdmin: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    get = mockGet;
  },
}));

vi.mock('@/lib/auth', () => ({ verifyAdmin: mockVerifyAdmin }));

import { GET } from './route';

function getStatus() {
  return GET(new NextRequest('http://localhost/api/scaleway/status'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/scaleway/status', () => {
  it('returns the connection status when settings exist', async () => {
    mockGet.mockResolvedValue({
      scaleway_is_connected: true,
      scaleway_project_id: 'proj-1',
      scaleway_connected_at: '2026-01-01T00:00:00.000Z',
    });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: true,
      project_id: 'proj-1',
      connected_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('defaults project_id and connected_at to null when absent', async () => {
    mockGet.mockResolvedValue({ scaleway_is_connected: false });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      project_id: null,
      connected_at: null,
    });
  });

  it('returns a disconnected default when the repository throws', async () => {
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      project_id: null,
      connected_at: null,
    });
  });

  // ComputeRequestPanel et ChallengeManageView ne lisent que `connected`.
  it('returns only `connected` to a non-admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    mockGet.mockResolvedValue({
      scaleway_is_connected: true,
      scaleway_project_id: 'proj-1',
      scaleway_connected_at: '2026-01-01T00:00:00.000Z',
    });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true });
  });

  it('returns only `connected: false` to a non-admin when the repository throws', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await getStatus();

    expect(await res.json()).toEqual({ connected: false });
  });
});
