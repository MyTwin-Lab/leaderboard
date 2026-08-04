import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { MockSelfVoteError, MockValidationTargetError, MockEndpointCallError, mockValidate } = vi.hoisted(() => ({
  MockSelfVoteError: class extends Error {},
  MockValidationTargetError: class extends Error {},
  MockEndpointCallError: class extends Error {},
  mockValidate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('../../../../../../../../packages/services/challenge/validation-challenge.service', () => ({
  ValidationChallengeService: class {
    validate = mockValidate;
  },
  SelfVoteError: MockSelfVoteError,
  ValidationTargetError: MockValidationTargetError,
  EndpointCallError: MockEndpointCallError,
}));

import { POST } from './route';
import { getSessionUser } from '@/lib/auth';

const mockGetSessionUser = getSessionUser as ReturnType<typeof vi.fn>;

const CHALLENGE_ID = 'challenge-1';

function buildRequest(fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value as any);
  }
  return new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validate`, {
    method: 'POST',
    body: form,
  });
}

function baseFields(overrides: Record<string, string | Blob> = {}) {
  return {
    contribution_id: '11111111-1111-4111-8111-111111111111',
    file: new File([Buffer.from('fake-file-bytes')], 'cat.png', { type: 'image/png' }),
    ...overrides,
  };
}

function postValidate(fields: Record<string, string | Blob>) {
  return POST(buildRequest(fields), { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1' });
});

describe('POST /api/challenges/[id]/validate', () => {
  it('returns 401 when not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const res = await postValidate(baseFields());

    expect(res.status).toBe(401);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('proxies to the service and returns its raw response body/headers', async () => {
    mockValidate.mockResolvedValue({
      body: Buffer.from('{"label":"cat"}'),
      contentType: 'application/json',
      status: 200,
    });

    const res = await postValidate(baseFields());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('X-Validation-Status')).toBe('200');
    expect(await res.text()).toBe('{"label":"cat"}');

    expect(mockValidate).toHaveBeenCalledTimes(1);
    const call = mockValidate.mock.calls[0][0];
    expect(call.validationChallengeId).toBe(CHALLENGE_ID);
    expect(call.contributionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(call.validatorUserId).toBe('user-1');
    expect(call.file.filename).toBe('cat.png');
    expect(call.file.mimeType).toBe('image/png');
    expect(Buffer.from(call.file.buffer).toString()).toBe('fake-file-bytes');
  });

  it('returns 400 when contribution_id is missing', async () => {
    const fields = baseFields();
    delete (fields as any).contribution_id;

    const res = await postValidate(fields);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/contribution_id/i);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('returns 400 when the file field is missing', async () => {
    const fields = baseFields();
    delete (fields as any).file;

    const res = await postValidate(fields);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/file/i);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('returns 413 when the file exceeds the 25MB cap', async () => {
    const bigFile = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'big.bin', { type: 'application/octet-stream' });

    const res = await postValidate(baseFields({ file: bigFile }));

    expect(res.status).toBe(413);
    expect(mockValidate).not.toHaveBeenCalled();
  }, 20000);

  it('maps SelfVoteError to 403', async () => {
    mockValidate.mockRejectedValue(new MockSelfVoteError('nope'));

    const res = await postValidate(baseFields());

    expect(res.status).toBe(403);
  });

  it('maps ValidationTargetError to 400', async () => {
    mockValidate.mockRejectedValue(new MockValidationTargetError('not exposed'));

    const res = await postValidate(baseFields());

    expect(res.status).toBe(400);
  });

  it('maps EndpointCallError to 502', async () => {
    mockValidate.mockRejectedValue(new MockEndpointCallError('target unreachable'));

    const res = await postValidate(baseFields());

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/target unreachable/);
  });

  it('maps an unknown error to 500', async () => {
    mockValidate.mockRejectedValue(new Error('boom'));

    const res = await postValidate(baseFields());

    expect(res.status).toBe(500);
  });
});
