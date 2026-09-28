import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRunJobNow } = vi.hoisted(() => ({ mockRunJobNow: vi.fn() }));

vi.mock('../../../../../packages/capabilities/cron', () => ({ runJobNow: mockRunJobNow }));

import { cronJobRoute } from './cronJobRoute';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;
const GET = cronJobRoute('meetings.check');

function call(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return GET(new NextRequest('http://localhost/api/cron/check-meetings', { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRunJobNow.mockResolvedValue({ key: 'meetings.check', owner: 'module:meetings', status: 'succeeded', result: { checked: 2 } });
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe('cronJobRoute', () => {
  it('returns 401 without the authorization header', async () => {
    expect((await call()).status).toBe(401);
    expect(mockRunJobNow).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is not configured server-side', async () => {
    delete process.env.CRON_SECRET;

    expect((await call('Bearer test-cron-secret')).status).toBe(401);
    expect(mockRunJobNow).not.toHaveBeenCalled();
  });

  it('runs its job and returns the result with a timestamp', async () => {
    const res = await call('Bearer test-cron-secret');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRunJobNow).toHaveBeenCalledWith('meetings.check');
    expect(body).toMatchObject({ success: true, status: 'succeeded', result: { checked: 2 } });
    expect(typeof body.timestamp).toBe('string');
  });

  it('reports a job already held by the tick without failing', async () => {
    mockRunJobNow.mockResolvedValue({ key: 'meetings.check', owner: 'module:meetings', status: 'busy' });

    const res = await call('Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, status: 'busy' });
  });

  it('returns 500 with the error message when the job fails', async () => {
    mockRunJobNow.mockResolvedValue({ key: 'meetings.check', owner: 'module:meetings', status: 'failed', error: 'sync failed' });

    const res = await call('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'sync failed' });
  });

  it('returns 500 when the job cannot be started', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRunJobNow.mockRejectedValue(new Error('Unknown job "meetings.check"'));

    const res = await call('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Unknown job "meetings.check"' });
    errorSpy.mockRestore();
  });
});
