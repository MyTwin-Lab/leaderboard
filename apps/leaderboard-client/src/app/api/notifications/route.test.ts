import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockFindByUser, mockCountUnread, mockMarkAllRead } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockFindByUser: vi.fn(),
  mockCountUnread: vi.fn(),
  mockMarkAllRead: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  NotificationRepository: class {
    findByUser = mockFindByUser;
    countUnread = mockCountUnread;
    markAllRead = mockMarkAllRead;
  },
}));

import { GET, PATCH } from './route';

function get() {
  return GET(new NextRequest('http://localhost/api/notifications'));
}
function patchAll() {
  return PATCH(new NextRequest('http://localhost/api/notifications', { method: 'PATCH' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
  mockCountUnread.mockResolvedValue(0);
  mockFindByUser.mockResolvedValue([]);
});

describe('GET /api/notifications', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });

  it('reads only the caller rows', async () => {
    await get();
    expect(mockFindByUser).toHaveBeenCalledWith('user-1');
  });

  it('returns the rows with a read flag and the unread count', async () => {
    mockFindByUser.mockResolvedValue([
      {
        uuid: 'n-1', type: 'group_invite', payload: { challengeTitle: 'X' },
        read_at: null, created_at: new Date('2026-09-01T10:00:00Z'),
      },
      {
        uuid: 'n-2', type: 'group_invite', payload: {},
        read_at: new Date('2026-09-02T10:00:00Z'), created_at: new Date('2026-09-02T09:00:00Z'),
      },
    ]);
    mockCountUnread.mockResolvedValue(1);

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unread).toBe(1);
    expect(body.notifications).toEqual([
      {
        uuid: 'n-1', type: 'group_invite', payload: { challengeTitle: 'X' },
        read: false, created_at: '2026-09-01T10:00:00.000Z',
      },
      {
        uuid: 'n-2', type: 'group_invite', payload: {},
        read: true, created_at: '2026-09-02T09:00:00.000Z',
      },
    ]);
  });

  it('never exposes dedupe_key, which is uniqueness plumbing', async () => {
    mockFindByUser.mockResolvedValue([
      {
        uuid: 'n-1', type: 'group_invite', payload: {},
        dedupe_key: 'group-abc', read_at: null, created_at: new Date('2026-09-01T10:00:00Z'),
      },
    ]);

    const body = await (await get()).json();

    expect(body.notifications[0]).not.toHaveProperty('dedupe_key');
    expect(Object.keys(body.notifications[0]).sort()).toEqual([
      'created_at', 'payload', 'read', 'type', 'uuid',
    ]);
  });
});

describe('PATCH /api/notifications', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await patchAll()).status).toBe(401);
  });

  it('marks the caller rows read and reports how many', async () => {
    mockMarkAllRead.mockResolvedValue(3);

    const res = await patchAll();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 3 });
    expect(mockMarkAllRead).toHaveBeenCalledWith('user-1');
  });
});
