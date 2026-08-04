import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockCheckComputeProvisioning } = vi.hoisted(() => ({
  mockCheckComputeProvisioning: vi.fn(),
}));

vi.mock('../../../../../../../packages/services/compute/cron-check-provisioning.js', () => ({
  checkComputeProvisioning: mockCheckComputeProvisioning,
}));

import { GET } from './route';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function getCron(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return GET(new NextRequest('http://localhost/api/cron/compute-provisioning', { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockCheckComputeProvisioning.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe('GET /api/cron/compute-provisioning', () => {
  it('returns 401 when the authorization header is missing', async () => {
    const res = await getCron();

    expect(res.status).toBe(401);
    expect(mockCheckComputeProvisioning).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer secret is wrong', async () => {
    const res = await getCron('Bearer wrong-secret');

    expect(res.status).toBe(401);
    expect(mockCheckComputeProvisioning).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is not configured server-side', async () => {
    delete process.env.CRON_SECRET;

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(401);
    expect(mockCheckComputeProvisioning).not.toHaveBeenCalled();
  });

  it('runs the provisioning check and returns success with a timestamp', async () => {
    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(mockCheckComputeProvisioning).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 500 with the error message when the job throws', async () => {
    mockCheckComputeProvisioning.mockRejectedValue(new Error('provider unreachable'));

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'provider unreachable' });
  });

  it('returns a generic error message when a non-Error is thrown', async () => {
    mockCheckComputeProvisioning.mockRejectedValue('boom');

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Unknown error' });
  });
});
