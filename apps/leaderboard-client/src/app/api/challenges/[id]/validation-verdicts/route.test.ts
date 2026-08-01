import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { MockSelfVoteError, MockDuplicateVerdictError, MockValidationTargetError, mockCastVerdict } = vi.hoisted(() => {
  return {
    MockSelfVoteError: class extends Error {},
    MockDuplicateVerdictError: class extends Error {},
    MockValidationTargetError: class extends Error {},
    mockCastVerdict: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('../../../../../../../../packages/services/challenge/validation-challenge.service', () => ({
  ValidationChallengeService: class {
    castVerdict = mockCastVerdict;
  },
  SelfVoteError: MockSelfVoteError,
  DuplicateVerdictError: MockDuplicateVerdictError,
  ValidationTargetError: MockValidationTargetError,
}));

import { POST } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

function buildRequest(fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value as any);
  }
  return new NextRequest('http://localhost/api/challenges/challenge-1/validation-verdicts', {
    method: 'POST',
    body: form,
  });
}

function baseFields(overrides: Record<string, string | Blob> = {}) {
  return {
    contribution_id: '11111111-1111-4111-8111-111111111111',
    verdict: 'works',
    file: new File([Buffer.from('fake-file-bytes')], 'cat.png', { type: 'image/png' }),
    response: new File([Buffer.from('{"label":"cat"}')], 'response', { type: 'application/json' }),
    response_content_type: 'application/json',
    response_status: '200',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1' });
});

describe('POST /api/challenges/[id]/validation-verdicts', () => {
  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const req = buildRequest(baseFields());

    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(401);
    expect(mockCastVerdict).not.toHaveBeenCalled();
  });

  it('persists the exact file/response bytes and metadata, forwarded to the service', async () => {
    mockCastVerdict.mockResolvedValue({ verdictRecorded: true, resolved: false, outcome: 'pending', verdictCount: 1, requiredValidations: 3, cpAwarded: 0 });
    const req = buildRequest(baseFields({ description: 'Looks great' }));

    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(200);
    expect(mockCastVerdict).toHaveBeenCalledTimes(1);
    const call = mockCastVerdict.mock.calls[0][0];
    expect(call.validationChallengeId).toBe('challenge-1');
    expect(call.contributionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(call.validatorUserId).toBe('user-1');
    expect(call.verdict).toBe('works');
    expect(call.description).toBe('Looks great');
    expect(call.file.filename).toBe('cat.png');
    expect(call.file.mimeType).toBe('image/png');
    expect(Buffer.from(call.file.buffer).toString()).toBe('fake-file-bytes');
    expect(call.response.contentType).toBe('application/json');
    expect(call.response.status).toBe(200);
    expect(Buffer.from(call.response.body).toString()).toBe('{"label":"cat"}');
  });

  it('defaults description to null when omitted', async () => {
    mockCastVerdict.mockResolvedValue({ verdictRecorded: true, resolved: false, outcome: 'pending', verdictCount: 1, requiredValidations: 3, cpAwarded: 0 });
    const req = buildRequest(baseFields());

    await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(mockCastVerdict.mock.calls[0][0].description).toBeNull();
  });

  it('falls back to status 200 when response_status is missing or not a number', async () => {
    mockCastVerdict.mockResolvedValue({ verdictRecorded: true, resolved: false, outcome: 'pending', verdictCount: 1, requiredValidations: 3, cpAwarded: 0 });
    const req = buildRequest(baseFields({ response_status: 'not-a-number' }));

    await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(mockCastVerdict.mock.calls[0][0].response.status).toBe(200);
  });

  it('rejects a "broken" verdict with no description (Zod refine)', async () => {
    const req = buildRequest(baseFields({ verdict: 'broken' }));

    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(400);
    expect(mockCastVerdict).not.toHaveBeenCalled();
  });

  it('rejects an invalid contribution_id (Zod)', async () => {
    const req = buildRequest(baseFields({ contribution_id: 'not-a-uuid' }));

    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when the file field is missing', async () => {
    const fields = baseFields();
    delete (fields as any).file;
    const req = buildRequest(fields);

    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/file/i);
  });

  it('returns 400 when the response field is missing', async () => {
    const fields = baseFields();
    delete (fields as any).response;
    const req = buildRequest(fields);

    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/response/i);
  });

  it('returns 413 when the file exceeds the 25MB cap', async () => {
    const bigFile = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'big.bin', { type: 'application/octet-stream' });
    const req = buildRequest(baseFields({ file: bigFile }));

    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(413);
    expect(mockCastVerdict).not.toHaveBeenCalled();
  }, 20000);

  it('returns 413 when the response exceeds the 10MB cap', async () => {
    const bigResponse = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'response', { type: 'application/json' });
    const req = buildRequest(baseFields({ response: bigResponse }));

    const res = await POST(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(413);
    expect(mockCastVerdict).not.toHaveBeenCalled();
  }, 20000);

  it('maps SelfVoteError to 403', async () => {
    mockCastVerdict.mockRejectedValue(new MockSelfVoteError('nope'));
    const res = await POST(buildRequest(baseFields()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(403);
  });

  it('maps DuplicateVerdictError to 409', async () => {
    mockCastVerdict.mockRejectedValue(new MockDuplicateVerdictError('already voted'));
    const res = await POST(buildRequest(baseFields()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(409);
  });

  it('maps ValidationTargetError to 400', async () => {
    mockCastVerdict.mockRejectedValue(new MockValidationTargetError('not exposed'));
    const res = await POST(buildRequest(baseFields()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(400);
  });

  it('maps an unknown error to 500', async () => {
    mockCastVerdict.mockRejectedValue(new Error('boom'));
    const res = await POST(buildRequest(baseFields()), { params: Promise.resolve({ id: 'challenge-1' }) });
    expect(res.status).toBe(500);
  });
});
