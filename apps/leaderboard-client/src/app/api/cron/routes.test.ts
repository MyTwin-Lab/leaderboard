import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRunJobNow } = vi.hoisted(() => ({ mockRunJobNow: vi.fn() }));

vi.mock('../../../../../../packages/capabilities/cron', () => ({ runJobNow: mockRunJobNow }));

import { GET as checkMeetings } from './check-meetings/route';
import { GET as slackSignals } from './slack-signals/route';
import { GET as computeProvisioning } from './compute-provisioning/route';
import { GET as computeExpiration } from './compute-expiration/route';
import { GET as digest } from './digest/route';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRunJobNow.mockImplementation(async (key: string) => ({ key, owner: 'test', status: 'succeeded' }));
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

// Les anciennes routes restent jusqu'au lot L7 : chacune lance son job du registre.
describe('legacy cron routes', () => {
  it.each([
    ['check-meetings', checkMeetings, 'meetings.check'],
    ['slack-signals', slackSignals, 'slack-signals.detect'],
    ['compute-provisioning', computeProvisioning, 'compute.provisioning'],
    ['compute-expiration', computeExpiration, 'compute.expiration'],
    ['digest', digest, 'digest.generate'],
  ] as const)('/api/cron/%s runs %s', async (name, GET, jobKey) => {
    const res = await GET(new NextRequest(`http://localhost/api/cron/${name}`, {
      headers: { authorization: 'Bearer test-cron-secret' },
    }));

    expect(res.status).toBe(200);
    expect(mockRunJobNow).toHaveBeenCalledWith(jobKey);
  });
});
