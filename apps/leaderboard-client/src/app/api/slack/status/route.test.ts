import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    get = mockGet;
  },
}));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/slack/status', () => {
  it('returns connection details when settings are available', async () => {
    mockGet.mockResolvedValue({
      slack_is_connected: true,
      slack_team_name: 'My Team',
      slack_connected_at: '2026-01-01T00:00:00.000Z',
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: true,
      team_name: 'My Team',
      connected_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('falls back to null for missing team_name and connected_at', async () => {
    mockGet.mockResolvedValue({ slack_is_connected: false });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      team_name: null,
      connected_at: null,
    });
  });

  it('returns a disconnected fallback when the repository throws', async () => {
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      team_name: null,
      connected_at: null,
    });
  });
});
