import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpdate, mockFetchContributorSession } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockFetchContributorSession: vi.fn(),
}));

vi.mock('@packages/database-service/repositories', () => ({
  AppSettingsRepository: class {
    update = mockUpdate;
  },
}));

vi.mock('@/lib/contributor', () => ({
  fetchContributorSession: mockFetchContributorSession,
}));

import { PATCH } from './route';

function patchSettings(body: unknown) {
  return PATCH(new Request('http://localhost/api/admin/digest-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({ digest_enabled: true, digest_frequency_days: 14 });
});

describe('PATCH /api/admin/digest-settings', () => {
  it('refuses an anonymous caller', async () => {
    mockFetchContributorSession.mockResolvedValue(null);
    expect((await patchSettings({ digest_enabled: true })).status).toBe(401);
  });

  it('refuses a contributor', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'contributor' });
    expect((await patchSettings({ digest_enabled: true })).status).toBe(403);
  });

  it('persists a valid update', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    const res = await patchSettings({ digest_enabled: true, digest_frequency_days: 14 });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      { digest_enabled: true, digest_frequency_days: 14 },
      'u1',
    );
    expect(await res.json()).toEqual({ digest_enabled: true, digest_frequency_days: 14 });
  });

  it('accepts a partial update', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    await patchSettings({ digest_enabled: false });
    expect(mockUpdate).toHaveBeenCalledWith({ digest_enabled: false }, 'u1');
  });

  it('rejects a frequency below one day', async () => {
    // Une fréquence de 0 rendrait le digest dû en permanence.
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    expect((await patchSettings({ digest_frequency_days: 0 })).status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a non-integer frequency', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    expect((await patchSettings({ digest_frequency_days: 2.5 })).status).toBe(400);
  });

  it('rejects a frequency beyond a year', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    expect((await patchSettings({ digest_frequency_days: 400 })).status).toBe(400);
  });

  it('rejects a body with nothing to update', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    expect((await patchSettings({})).status).toBe(400);
  });
});
