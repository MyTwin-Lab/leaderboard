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

describe('GET /api/scaleway/status', () => {
  it('returns the connection status when settings exist', async () => {
    mockGet.mockResolvedValue({
      scaleway_is_connected: true,
      scaleway_project_id: 'proj-1',
      scaleway_connected_at: '2026-01-01T00:00:00.000Z',
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: true,
      project_id: 'proj-1',
      connected_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('defaults project_id and connected_at to null when absent', async () => {
    mockGet.mockResolvedValue({ scaleway_is_connected: false });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      project_id: null,
      connected_at: null,
    });
  });

  it('returns a disconnected default when the repository throws', async () => {
    mockGet.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      project_id: null,
      connected_at: null,
    });
  });
});
