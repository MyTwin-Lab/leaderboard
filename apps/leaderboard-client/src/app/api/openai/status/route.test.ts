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

describe('GET /api/openai/status', () => {
  it('returns the connection status when settings are available', async () => {
    mockGet.mockResolvedValue({ openai_is_connected: true, openai_connected_at: '2026-01-01T00:00:00.000Z' });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true, connected_at: '2026-01-01T00:00:00.000Z' });
  });

  it('defaults connected_at to null when unset', async () => {
    mockGet.mockResolvedValue({ openai_is_connected: false, openai_connected_at: undefined });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false, connected_at: null });
  });

  it('returns a disconnected fallback when the repository throws', async () => {
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false, connected_at: null });
  });
});
