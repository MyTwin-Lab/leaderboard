import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAll } = vi.hoisted(() => ({
  mockAll: vi.fn(),
}));

vi.mock('@packages/capabilities/modules', () => ({
  modules: { all: mockAll },
}));

import { GET } from './route';

const state = (key: string, enabled: boolean) => ({
  key, label: key, description: null, enabled, settings: { secret: 'admin only' }, updatedAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAll.mockResolvedValue([state('meetings', true), state('sandbox', false)]);
});

describe('GET /api/modules', () => {
  it('lists the installed modules without their settings', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      modules: [
        { key: 'meetings', label: 'meetings', description: null, enabled: true },
        { key: 'sandbox', label: 'sandbox', description: null, enabled: false },
      ],
    });
  });
});
