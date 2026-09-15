import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateConnector, mockListChannels, mockFindAll, mockGetSessionUser } = vi.hoisted(() => ({
  mockCreateConnector: vi.fn(),
  mockListChannels: vi.fn(),
  mockFindAll: vi.fn(),
  mockGetSessionUser: vi.fn(),
}));

vi.mock('../../../../../../../packages/connectors/registry.js', () => ({
  ConnectorRegistry: { createConnector: mockCreateConnector },
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  ProjectRepository: class {
    findAll = mockFindAll;
  },
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockCreateConnector.mockResolvedValue({ listChannels: mockListChannels });
  mockListChannels.mockResolvedValue([{ id: 'C1', name: 'general' }]);
  mockFindAll.mockResolvedValue([]);
});

describe('GET /api/slack/channels', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockCreateConnector).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin who does not manage any project', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockFindAll.mockResolvedValue([{ uuid: 'p1', manager_id: 'someone-else' }]);

    const res = await GET();

    expect(res.status).toBe(403);
    expect(mockCreateConnector).not.toHaveBeenCalled();
  });

  it('returns the channel list for an admin, read through the Slack connector', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'C1', name: 'general' }]);
    expect(mockCreateConnector).toHaveBeenCalledWith({ type: 'slack' });
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('returns the channel list for a non-admin who manages a project', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', role: 'contributor' });
    mockFindAll.mockResolvedValue([{ uuid: 'p1', manager_id: 'u1' }]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'C1', name: 'general' }]);
  });

  it('returns 400 when Slack is not connected', async () => {
    mockCreateConnector.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Slack is not connected' });
    expect(mockListChannels).not.toHaveBeenCalled();
  });

  it('returns 502 when listing channels fails', async () => {
    mockListChannels.mockRejectedValue(new Error('slack down'));

    const res = await GET();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to list Slack channels' });
  });
});
