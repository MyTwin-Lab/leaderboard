import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate, mockFetchContributorSession } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockFetchContributorSession: vi.fn(),
}));

vi.mock('../../../../../../../../packages/services/digest/digest.service.js', () => ({
  DigestService: class {
    generate = mockGenerate;
  },
}));

vi.mock('@/lib/contributor', () => ({
  fetchContributorSession: mockFetchContributorSession,
}));

import { POST } from './route';

function post(body?: unknown) {
  return POST(new Request('http://localhost/api/admin/digests/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerate.mockResolvedValue({ uuid: 'd-1', payload: { version: 1 } });
});

describe('POST /api/admin/digests/generate', () => {
  it('refuses an anonymous caller', async () => {
    mockFetchContributorSession.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
  });

  it('refuses a contributor', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'contributor' });
    expect((await post()).status).toBe(403);
  });

  it('generates from the cursor when no start is given', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    const res = await post();
    expect(res.status).toBe(201);
    expect(mockGenerate).toHaveBeenCalledWith('manual', {});
  });

  it('tolerates an empty body', async () => {
    // Le bouton peut poster sans corps du tout.
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    expect((await post(undefined)).status).toBe(201);
  });

  it('passes an explicit start through', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    await post({ period_start: '2026-09-01T00:00:00.000Z' });

    const [, opts] = mockGenerate.mock.calls[0];
    expect(opts.periodStart.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('accepts a plain date and reads it as midnight UTC', async () => {
    // L'input date de l'onglet envoie "2026-09-01" : sans normalisation, le
    // fuseau du navigateur déciderait de la borne.
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    await post({ period_start: '2026-09-01' });

    const [, opts] = mockGenerate.mock.calls[0];
    expect(opts.periodStart.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('rejects an unparseable start', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    expect((await post({ period_start: 'not a date' })).status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('rejects a start in the future', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect((await post({ period_start: tomorrow })).status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('surfaces a generation failure as a 500', async () => {
    mockFetchContributorSession.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockGenerate.mockRejectedValue(new Error('boom'));

    const res = await post();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('boom');
  });
});
