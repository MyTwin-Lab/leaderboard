import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRunDueJobs } = vi.hoisted(() => ({ mockRunDueJobs: vi.fn() }));

vi.mock('../../../../../../../packages/capabilities/cron', () => ({ runDueJobs: mockRunDueJobs }));

import { GET } from './route';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function tick(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return GET(new NextRequest('http://localhost/api/cron/tick', { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRunDueJobs.mockResolvedValue([
    { key: 'compute.expiration', owner: 'extension:compute', status: 'succeeded' },
    { key: 'digest.generate', owner: 'module:digest', status: 'not_due' },
  ]);
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe('GET /api/cron/tick', () => {
  it('returns 401 without the right bearer and runs nothing', async () => {
    expect((await tick()).status).toBe(401);
    expect((await tick('Bearer wrong')).status).toBe(401);
    expect(mockRunDueJobs).not.toHaveBeenCalled();
  });

  it('runs the due jobs and returns their summary', async () => {
    const res = await tick('Bearer test-cron-secret');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRunDueJobs).toHaveBeenCalledOnce();
    expect(body).toMatchObject({
      success: true,
      jobs: [
        { key: 'compute.expiration', status: 'succeeded' },
        { key: 'digest.generate', status: 'not_due' },
      ],
    });
  });

  it('flags a failed job without failing the tick', async () => {
    mockRunDueJobs.mockResolvedValue([{ key: 'meetings.check', owner: 'module:meetings', status: 'failed', error: 'Meet down' }]);

    const res = await tick('Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: false, jobs: [{ status: 'failed', error: 'Meet down' }] });
  });

  it('returns 500 when the jobs cannot be listed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRunDueJobs.mockRejectedValue(new Error('db down'));

    const res = await tick('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    errorSpy.mockRestore();
  });
});
