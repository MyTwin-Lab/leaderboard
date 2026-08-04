import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockFindByManagerId, mockUpdate } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockFindByManagerId: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/db', () => ({
  repositories: {
    project: { findByManagerId: mockFindByManagerId },
  },
}));
vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class {
    update = mockUpdate;
  },
}));

import { GET, PATCH } from './route';

const SESSION = { id: 'user-1', full_name: 'Ada Lovelace', role: 'contributor' };

function patchMe(body: unknown) {
  const req = new NextRequest('http://localhost/api/contributors/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PATCH(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue(SESSION);
  mockFindByManagerId.mockResolvedValue([]);
  mockUpdate.mockResolvedValue(undefined);
});

describe('GET /api/contributors/me', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns the session user and managed project ids', async () => {
    mockFindByManagerId.mockResolvedValue([{ uuid: 'p1' }, { uuid: 'p2' }]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: SESSION, managedProjectIds: ['p1', 'p2'] });
    expect(mockFindByManagerId).toHaveBeenCalledWith('user-1');
  });
});

describe('PATCH /api/contributors/me', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await patchMe({ full_name: 'New Name' });

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates full_name after trimming it', async () => {
    const res = await patchMe({ full_name: '  New Name  ' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith('user-1', { full_name: 'New Name' });
  });

  it('returns 400 when full_name is empty after trimming', async () => {
    const res = await patchMe({ full_name: '   ' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when full_name exceeds 255 characters', async () => {
    const res = await patchMe({ full_name: 'a'.repeat(256) });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates a valid github_username', async () => {
    const res = await patchMe({ github_username: 'octocat' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', { github_username: 'octocat' });
  });

  it('allows clearing github_username with an empty string', async () => {
    const res = await patchMe({ github_username: '' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', { github_username: '' });
  });

  it('returns 400 for an invalid github_username', async () => {
    const res = await patchMe({ github_username: '-bad-start' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates a valid avatar_url data URL', async () => {
    const avatar_url = 'data:image/png;base64,AAAA';

    const res = await patchMe({ avatar_url });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', { avatar_url });
  });

  it('returns 400 for an avatar_url with a disallowed mime type', async () => {
    const res = await patchMe({ avatar_url: 'data:application/pdf;base64,AAAA' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 413 when avatar_url exceeds the 500KB cap', async () => {
    const avatar_url = 'data:image/png;base64,' + 'A'.repeat(700_000);

    const res = await patchMe({ avatar_url });

    expect(res.status).toBe(413);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('accepts a null avatar_url without mime validation', async () => {
    const res = await patchMe({ avatar_url: null });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', { avatar_url: undefined });
  });

  it('sends only the provided fields to the repository', async () => {
    await patchMe({ full_name: 'New Name' });

    expect(mockUpdate).toHaveBeenCalledWith('user-1', { full_name: 'New Name' });
  });
});
