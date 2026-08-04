import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRunSlackSignalsCron } = vi.hoisted(() => ({
  mockRunSlackSignalsCron: vi.fn(),
}));

vi.mock('../../../../../../../packages/services/slack/cron-slack-signals.js', () => ({
  runSlackSignalsCron: mockRunSlackSignalsCron,
}));

import { GET } from './route';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function getCron(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return GET(new NextRequest('http://localhost/api/cron/slack-signals', { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRunSlackSignalsCron.mockResolvedValue([{ challengeId: 'c1', signalsSent: 2 }]);
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe('GET /api/cron/slack-signals', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const res = await getCron();

    expect(res.status).toBe(401);
    expect(mockRunSlackSignalsCron).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer secret is wrong', async () => {
    const res = await getCron('Bearer wrong-secret');

    expect(res.status).toBe(401);
    expect(mockRunSlackSignalsCron).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is not configured server-side', async () => {
    delete process.env.CRON_SECRET;

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(401);
    expect(mockRunSlackSignalsCron).not.toHaveBeenCalled();
  });

  it('runs the job and returns success with the summaries and a timestamp', async () => {
    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(mockRunSlackSignalsCron).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.timestamp).toBe('string');
    expect(body.summaries).toEqual([{ challengeId: 'c1', signalsSent: 2 }]);
  });

  it('returns 500 with the error message when the job throws', async () => {
    mockRunSlackSignalsCron.mockRejectedValue(new Error('slack api down'));

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'slack api down' });
  });

  it('returns a generic error message when a non-Error is thrown', async () => {
    mockRunSlackSignalsCron.mockRejectedValue('boom');

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Unknown error' });
  });
});
