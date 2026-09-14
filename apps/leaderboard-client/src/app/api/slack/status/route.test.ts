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
  return GET(new NextRequest('http://localhost/api/slack/status'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
});

describe('GET /api/slack/status', () => {
  it('returns connection details when settings are available', async () => {
    mockGet.mockResolvedValue({
      slack_is_connected: true,
      slack_team_name: 'My Team',
      slack_connected_at: '2026-01-01T00:00:00.000Z',
    });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: true,
      team_name: 'My Team',
      connected_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('falls back to null for missing team_name and connected_at', async () => {
    mockGet.mockResolvedValue({ slack_is_connected: false });

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      team_name: null,
      connected_at: null,
    });
  });

  it('returns a disconnected fallback when the repository throws', async () => {
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await getStatus();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      team_name: null,
      connected_at: null,
    });
  });

  it('returns only `connected` to a non-admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    mockGet.mockResolvedValue({
      slack_is_connected: true,
      slack_team_name: 'My Team',
      slack_connected_at: '2026-01-01T00:00:00.000Z',
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
