import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAll, mockState, mockUpdate, mockFetchContributorSession } = vi.hoisted(() => ({
  mockAll: vi.fn(),
  mockState: vi.fn(),
  mockUpdate: vi.fn(),
  mockFetchContributorSession: vi.fn(),
}));

vi.mock('@packages/capabilities/modules', () => ({
  modules: { all: mockAll, state: mockState, update: mockUpdate },
}));

vi.mock('@/lib/contributor', () => ({
  fetchContributorSession: mockFetchContributorSession,
}));

import { GET, PATCH } from './route';

const state = (key: string, enabled: boolean) => ({
  key, label: key, description: null, enabled, settings: { secret: 'admin only' }, updatedAt: null,
});

function patchModules(body: unknown) {
  const req = new Request('http://localhost/api/modules', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PATCH(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAll.mockResolvedValue([state('meetings', true), state('sandbox', true)]);
  mockState.mockImplementation(async (key: string) => (key === 'onboarding' ? null : state(key, true)));
});

describe('GET /api/modules', () => {
  it('lists the installed modules without their settings, plus the legacy flags', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      modules: [
        { key: 'meetings', label: 'meetings', description: null, enabled: true },
        { key: 'sandbox', label: 'sandbox', description: null, enabled: true },
      ],
      meetings_enabled: true,
      onboarding_enabled: false,
    });
  });
});

describe('PATCH /api/modules', () => {
  it('returns 403 without an admin session', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'contributor' });

    const res = await patchModules({ meetings_enabled: false });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates the modules named by the legacy boolean fields', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'admin-1', role: 'admin' });

    const res = await patchModules({ meetings_enabled: false, extra: 'ignored' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('meetings', { enabled: false }, 'admin-1');
  });

  it('ignores a module the distribution does not install, and non-boolean values', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'admin-1', role: 'admin' });

    await patchModules({ onboarding_enabled: true, meetings_enabled: 'yes' });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
