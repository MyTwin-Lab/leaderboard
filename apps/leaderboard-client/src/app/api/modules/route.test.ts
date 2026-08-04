import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockUpdate, mockFetchContributorSession } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUpdate: vi.fn(),
  mockFetchContributorSession: vi.fn(),
}));

vi.mock('@packages/database-service/repositories', () => ({
  AppSettingsRepository: class {
    get = mockGet;
    update = mockUpdate;
  },
}));

vi.mock('@/lib/contributor', () => ({
  fetchContributorSession: mockFetchContributorSession,
}));

import { GET, PATCH } from './route';

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
});

describe('GET /api/modules', () => {
  it('returns the current module flags', async () => {
    mockGet.mockResolvedValue({
      modules_meetings_enabled: true,
      modules_onboarding_enabled: false,
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      meetings_enabled: true,
      onboarding_enabled: false,
    });
  });
});

describe('PATCH /api/modules', () => {
  it('returns 403 when there is no session', async () => {
    mockFetchContributorSession.mockResolvedValue(null);

    const res = await patchModules({ meetings_enabled: true });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 when the session is not an admin', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'contributor' });

    const res = await patchModules({ meetings_enabled: true });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates only the boolean fields present in the body', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockUpdate.mockResolvedValue({
      modules_meetings_enabled: true,
      modules_onboarding_enabled: false,
    });

    const res = await patchModules({ meetings_enabled: true, extra: 'ignored' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ modules_meetings_enabled: true }, 'admin-1');
    expect(await res.json()).toEqual({
      meetings_enabled: true,
      onboarding_enabled: false,
    });
  });

  it('updates both flags when both are provided', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockUpdate.mockResolvedValue({
      modules_meetings_enabled: false,
      modules_onboarding_enabled: true,
    });

    await patchModules({ meetings_enabled: false, onboarding_enabled: true });

    expect(mockUpdate).toHaveBeenCalledWith(
      { modules_meetings_enabled: false, modules_onboarding_enabled: true },
      'admin-1',
    );
  });

  it('sends an empty patch when no recognized boolean fields are provided', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockUpdate.mockResolvedValue({
      modules_meetings_enabled: false,
      modules_onboarding_enabled: false,
    });

    await patchModules({ meetings_enabled: 'not-a-boolean' });

    expect(mockUpdate).toHaveBeenCalledWith({}, 'admin-1');
  });
});
