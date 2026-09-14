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
  return GET(new NextRequest('http://localhost/api/openai/status'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/openai/status', () => {
  it('returns the connection status when settings are available', async () => {
    mockGet.mockResolvedValue({ openai_is_connected: true, openai_connected_at: '2026-01-01T00:00:00.000Z' });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true, connected_at: '2026-01-01T00:00:00.000Z' });
  });

  it('defaults connected_at to null when unset', async () => {
    mockGet.mockResolvedValue({ openai_is_connected: false, openai_connected_at: undefined });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false, connected_at: null });
  });

  it('returns a disconnected fallback when the repository throws', async () => {
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false, connected_at: null });
  });

  it('returns only `connected` to a non-admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    mockGet.mockResolvedValue({ openai_is_connected: true, openai_connected_at: '2026-01-01T00:00:00.000Z' });

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
