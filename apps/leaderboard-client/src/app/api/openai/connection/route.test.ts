import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken, mockEncryptToken, mockUpdateOpenAIConnection, mockClearOpenAIConnection,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockEncryptToken: vi.fn(),
  mockUpdateOpenAIConnection: vi.fn(),
  mockClearOpenAIConnection: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../packages/config/openaiCredentials.js', () => ({
  encryptToken: mockEncryptToken,
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    updateOpenAIConnection = mockUpdateOpenAIConnection;
    clearOpenAIConnection = mockClearOpenAIConnection;
  },
}));

import { POST, DELETE } from './route';

function postConnection(body: unknown) {
  const req = new NextRequest('http://localhost/api/openai/connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

function postConnectionRawBody(rawBody: string) {
  const req = new NextRequest('http://localhost/api/openai/connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
  return POST(req);
}

function deleteConnection() {
  const req = new NextRequest('http://localhost/api/openai/connection', { method: 'DELETE' });
  return DELETE(req);
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockEncryptToken.mockReturnValue({ enc: 'enc-value', iv: 'iv-value' });
  fetchMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/openai/connection', () => {
  it('saves a valid API key', async () => {
    const res = await postConnection({ api_key: 'sk-valid' });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
      headers: { Authorization: 'Bearer sk-valid' },
    });
    expect(mockEncryptToken).toHaveBeenCalledWith('sk-valid');
    expect(mockUpdateOpenAIConnection).toHaveBeenCalledWith({
      openai_key_enc: 'enc-value',
      openai_key_iv: 'iv-value',
      openai_connected_by: 'admin-1',
    });
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await postConnection({ api_key: 'sk-valid' });

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 401 for a non-admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });

    const res = await postConnection({ api_key: 'sk-valid' });

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON body', async () => {
    const res = await postConnectionRawBody('not-json');

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('returns 400 when api_key is missing or blank', async () => {
    const res = await postConnection({ api_key: '   ' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'api_key is required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 when OpenAI rejects the key', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    const res = await postConnection({ api_key: 'sk-bad' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid OpenAI API key' });
    expect(mockUpdateOpenAIConnection).not.toHaveBeenCalled();
  });

  it('returns 502 when OpenAI cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const res = await postConnection({ api_key: 'sk-valid' });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Could not reach OpenAI API' });
  });

  it('returns 500 when saving credentials fails', async () => {
    mockUpdateOpenAIConnection.mockRejectedValue(new Error('db down'));

    const res = await postConnection({ api_key: 'sk-valid' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to save credentials' });
  });
});

describe('DELETE /api/openai/connection', () => {
  it('clears the stored credentials', async () => {
    const res = await deleteConnection();

    expect(res.status).toBe(200);
    expect(mockClearOpenAIConnection).toHaveBeenCalled();
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await deleteConnection();

    expect(res.status).toBe(401);
    expect(mockClearOpenAIConnection).not.toHaveBeenCalled();
  });

  it('returns 401 for a non-admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });

    const res = await deleteConnection();

    expect(res.status).toBe(401);
    expect(mockClearOpenAIConnection).not.toHaveBeenCalled();
  });

  it('returns 500 when clearing fails', async () => {
    mockClearOpenAIConnection.mockRejectedValue(new Error('db down'));

    const res = await deleteConnection();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to clear credentials' });
  });
});
