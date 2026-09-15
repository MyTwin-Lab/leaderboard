import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockState, mockUpdate, mockFetchContributorSession, MockModuleNotFoundError, MockModuleSettingsError } = vi.hoisted(() => ({
  mockState: vi.fn(),
  mockUpdate: vi.fn(),
  mockFetchContributorSession: vi.fn(),
  MockModuleNotFoundError: class extends Error {},
  MockModuleSettingsError: class extends Error {},
}));

vi.mock('@packages/capabilities/modules', () => ({
  modules: { state: mockState, update: mockUpdate },
  ModuleNotFoundError: MockModuleNotFoundError,
  ModuleSettingsError: MockModuleSettingsError,
}));

vi.mock('@/lib/contributor', () => ({
  fetchContributorSession: mockFetchContributorSession,
}));

import { GET, PATCH } from './route';

const DIGEST = { key: 'digest', label: 'Digest', description: null, enabled: true, settings: { frequency_days: 7 }, updatedAt: null };
const params = (key = 'digest') => ({ params: Promise.resolve({ key }) });

function patch(body: unknown, key = 'digest') {
  return PATCH(
    new Request(`http://localhost/api/modules/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params(key),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchContributorSession.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockState.mockResolvedValue(DIGEST);
  mockUpdate.mockResolvedValue(DIGEST);
});

describe('GET /api/modules/[key]', () => {
  it('returns the state and settings to an admin', async () => {
    const res = await GET(new Request('http://localhost/api/modules/digest'), params());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(DIGEST);
  });

  it('answers 401 without a session, 403 for a non-admin, 404 for an unknown module', async () => {
    mockFetchContributorSession.mockResolvedValueOnce(null);
    expect((await GET(new Request('http://localhost'), params())).status).toBe(401);

    mockFetchContributorSession.mockResolvedValueOnce({ id: 'u1', role: 'contributor' });
    expect((await GET(new Request('http://localhost'), params())).status).toBe(403);

    mockState.mockResolvedValueOnce(null);
    expect((await GET(new Request('http://localhost'), params('nope'))).status).toBe(404);
  });
});

describe('PATCH /api/modules/[key]', () => {
  it('passes the state and settings to the capability', async () => {
    const res = await patch({ enabled: false, settings: { frequency_days: 14 } });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('digest', { enabled: false, settings: { frequency_days: 14 } }, 'admin-1');
  });

  it('rejects a malformed body before touching anything', async () => {
    expect((await patch({ enabled: 'yes' })).status).toBe(400);
    expect((await patch({ settings: [1] })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('maps an unknown module to 404 and invalid settings to 400', async () => {
    mockUpdate.mockRejectedValueOnce(new MockModuleNotFoundError('nope'));
    expect((await patch({ enabled: true }, 'nope')).status).toBe(404);

    mockUpdate.mockRejectedValueOnce(new MockModuleSettingsError('frequency_days too small'));
    const res = await patch({ settings: { frequency_days: 0 } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid settings', details: 'frequency_days too small' });
  });
});
