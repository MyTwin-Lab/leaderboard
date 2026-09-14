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
  return GET(new NextRequest('http://localhost/api/kaggle/status'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/kaggle/status', () => {
  it('returns the connection status when settings are readable', async () => {
    mockGet.mockResolvedValue({
      kaggle_is_connected: true,
      kaggle_username: 'ada',
      kaggle_connected_at: '2026-07-01T00:00:00.000Z',
    });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: true,
      username: 'ada',
      connected_at: '2026-07-01T00:00:00.000Z',
    });
  });

  it('falls back to null username/connected_at when unset', async () => {
    mockGet.mockResolvedValue({
      kaggle_is_connected: false,
      kaggle_username: null,
      kaggle_connected_at: null,
    });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      username: null,
      connected_at: null,
    });
  });

  it('returns a safe disconnected payload when the settings lookup throws', async () => {
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false, username: null, connected_at: null });
  });

  it('returns only `connected` to a non-admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    mockGet.mockResolvedValue({
      kaggle_is_connected: true,
      kaggle_username: 'ada',
      kaggle_connected_at: '2026-07-01T00:00:00.000Z',
    });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true });
  });

  it('returns only `connected: false` to a non-admin when the lookup throws', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await getStatus();

    expect(await res.json()).toEqual({ connected: false });
  });
});
