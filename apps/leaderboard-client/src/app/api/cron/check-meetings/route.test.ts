import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockCheckCompletedMeetings } = vi.hoisted(() => ({
  mockCheckCompletedMeetings: vi.fn(),
}));

vi.mock('../../../../../../../packages/services/sync-meeting/cron-check-meetings.js', () => ({
  checkCompletedMeetings: mockCheckCompletedMeetings,
}));

import { GET } from './route';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function getCron(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return GET(new NextRequest('http://localhost/api/cron/check-meetings', { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockCheckCompletedMeetings.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe('GET /api/cron/check-meetings', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const res = await getCron();

    expect(res.status).toBe(401);
    expect(mockCheckCompletedMeetings).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer secret is wrong', async () => {
    const res = await getCron('Bearer wrong-secret');

    expect(res.status).toBe(401);
    expect(mockCheckCompletedMeetings).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is not configured server-side', async () => {
    delete process.env.CRON_SECRET;

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(401);
    expect(mockCheckCompletedMeetings).not.toHaveBeenCalled();
  });

  it('runs the check and returns success with a timestamp', async () => {
    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(mockCheckCompletedMeetings).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 500 with the error message when the job throws', async () => {
    mockCheckCompletedMeetings.mockRejectedValue(new Error('sync failed'));

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'sync failed' });
  });

  it('returns a generic error message when a non-Error is thrown', async () => {
    mockCheckCompletedMeetings.mockRejectedValue('boom');

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Unknown error' });
  });
});
