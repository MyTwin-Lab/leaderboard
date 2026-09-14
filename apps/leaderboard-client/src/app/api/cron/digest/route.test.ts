import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRunDigestCron, mockRunRetentionPurges } = vi.hoisted(() => ({
  mockRunDigestCron: vi.fn(),
  mockRunRetentionPurges: vi.fn(),
}));

vi.mock('../../../../../../../packages/services/digest/cron-digest.js', () => ({
  runDigestCron: mockRunDigestCron,
}));
vi.mock('./retention', () => ({ runRetentionPurges: mockRunRetentionPurges }));

import { GET } from './route';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function getCron(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return GET(new NextRequest('http://localhost/api/cron/digest', { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRunDigestCron.mockResolvedValue({ generated: false, reason: 'disabled' });
  mockRunRetentionPurges.mockResolvedValue({
    expiredRefreshTokens: 1,
    purgedIpHashes: 2,
    purgedReferenceCases: 0,
    purgedCaseClaims: 0,
  });
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe('GET /api/cron/digest', () => {
  it('returns 401 without the right bearer and runs nothing', async () => {
    const res = await getCron('Bearer wrong');
    expect(res.status).toBe(401);
    expect(mockRunRetentionPurges).not.toHaveBeenCalled();
    expect(mockRunDigestCron).not.toHaveBeenCalled();
  });

  it('runs the retention purges even when the digest is disabled', async () => {
    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(mockRunRetentionPurges).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      generated: false,
      reason: 'disabled',
      retention: { expiredRefreshTokens: 1, purgedIpHashes: 2 },
    });
  });

  it('still purges when the digest generation throws', async () => {
    mockRunDigestCron.mockRejectedValue(new Error('openai down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await getCron('Bearer test-cron-secret');

    expect(res.status).toBe(500);
    expect(mockRunRetentionPurges).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
