import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFetchContributorSession, mockUpdate } = vi.hoisted(() => ({
  mockFetchContributorSession: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/contributor', () => ({
  fetchContributorSession: mockFetchContributorSession,
}));

vi.mock('@packages/database-service/repositories', () => ({
  AppSettingsRepository: class {
    update = mockUpdate;
  },
}));

import { PATCH } from './route';

function patchTheme(body: unknown) {
  const req = new NextRequest('http://localhost/api/admin/theme', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PATCH(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchContributorSession.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('PATCH /api/admin/theme', () => {
  it('updates the theme settings for a valid payload', async () => {
    mockUpdate.mockResolvedValue({
      theme_key: 'purple-dark',
      primary_color: '#123456',
      background_color: '#abcdef',
      theme_mode: 'dark',
    });

    const res = await patchTheme({
      theme_key: 'purple-dark',
      primary_color: '#123456',
      background_color: '#abcdef',
      theme_mode: 'dark',
    });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      { theme_key: 'purple-dark', primary_color: '#123456', background_color: '#abcdef', theme_mode: 'dark' },
      'admin-1',
    );
    expect(await res.json()).toEqual({
      theme_key: 'purple-dark',
      primary_color: '#123456',
      background_color: '#abcdef',
      theme_mode: 'dark',
    });
  });

  it('allows null colors and a partial payload', async () => {
    mockUpdate.mockResolvedValue({
      theme_key: undefined,
      primary_color: null,
      background_color: null,
      theme_mode: undefined,
    });

    const res = await patchTheme({ primary_color: null, background_color: null });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      { theme_key: undefined, primary_color: null, background_color: null, theme_mode: undefined },
      'admin-1',
    );
  });

  it('returns 401 when there is no session', async () => {
    mockFetchContributorSession.mockResolvedValue(null);

    const res = await patchTheme({ theme_key: 'default' });

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 when the session user is not an admin', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'user-1', role: 'contributor' });

    const res = await patchTheme({ theme_key: 'default' });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid theme_key', async () => {
    const res = await patchTheme({ theme_key: 'not-a-theme' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid theme_key' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid primary_color', async () => {
    const res = await patchTheme({ primary_color: 'not-a-hex-color' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid primary_color' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid background_color', async () => {
    const res = await patchTheme({ background_color: '#zzzzzz' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid background_color' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid theme_mode', async () => {
    const res = await patchTheme({ theme_mode: 'rainbow' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid theme_mode' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
