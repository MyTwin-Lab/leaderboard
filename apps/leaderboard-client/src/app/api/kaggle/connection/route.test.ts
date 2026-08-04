import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken, mockEncryptToken, mockUpdateKaggleConnection, mockClearKaggleConnection,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockEncryptToken: vi.fn(),
  mockUpdateKaggleConnection: vi.fn(),
  mockClearKaggleConnection: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../packages/config/kaggleCredentials.js', () => ({
  encryptToken: mockEncryptToken,
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    updateKaggleConnection = mockUpdateKaggleConnection;
    clearKaggleConnection = mockClearKaggleConnection;
  },
}));

import { POST, DELETE } from './route';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function postConnection(body: unknown) {
  const req = new NextRequest('http://localhost/api/kaggle/connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

function postConnectionRaw(rawBody: string) {
  const req = new NextRequest('http://localhost/api/kaggle/connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
  return POST(req);
}

function deleteConnection() {
  const req = new NextRequest('http://localhost/api/kaggle/connection', { method: 'DELETE' });
  return DELETE(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockFetch.mockResolvedValue({ ok: true });
  mockEncryptToken.mockReturnValue({ enc: 'enc-value', iv: 'iv-value' });
  mockUpdateKaggleConnection.mockResolvedValue(undefined);
  mockClearKaggleConnection.mockResolvedValue(undefined);
});

describe('POST /api/kaggle/connection', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await postConnection({ username: 'ada', api_key: 'k1' });

    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 401 when authenticated but not admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });

    const res = await postConnection({ username: 'ada', api_key: 'k1' });

    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON body', async () => {
    const res = await postConnectionRaw('not-json{');

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('returns 400 when username or api_key is missing', async () => {
    const res = await postConnection({ username: '', api_key: '' });

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 when Kaggle rejects the credentials', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const res = await postConnection({ username: 'ada', api_key: 'bad-key' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid Kaggle credentials' });
    expect(mockUpdateKaggleConnection).not.toHaveBeenCalled();
  });

  it('returns 502 when the Kaggle API cannot be reached', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const res = await postConnection({ username: 'ada', api_key: 'k1' });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Could not reach Kaggle API' });
  });

  it('returns 500 when saving the encrypted credentials fails', async () => {
    mockUpdateKaggleConnection.mockRejectedValue(new Error('db down'));

    const res = await postConnection({ username: 'ada', api_key: 'k1' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to save credentials' });
  });

  it('saves the encrypted credentials and returns success on the nominal path', async () => {
    const res = await postConnection({ username: '  ada  ', api_key: '  k1  ' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockEncryptToken).toHaveBeenCalledWith('k1');
    expect(mockUpdateKaggleConnection).toHaveBeenCalledWith({
      kaggle_username: 'ada',
      kaggle_key_enc: 'enc-value',
      kaggle_key_iv: 'iv-value',
      kaggle_connected_by: 'admin-1',
    });
  });
});

describe('DELETE /api/kaggle/connection', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await deleteConnection();

    expect(res.status).toBe(401);
    expect(mockClearKaggleConnection).not.toHaveBeenCalled();
  });

  it('returns 401 when not admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });

    const res = await deleteConnection();

    expect(res.status).toBe(401);
  });

  it('clears the connection and returns success', async () => {
    const res = await deleteConnection();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockClearKaggleConnection).toHaveBeenCalled();
  });

  it('returns 500 when clearing the connection fails', async () => {
    mockClearKaggleConnection.mockRejectedValue(new Error('db down'));

    const res = await deleteConnection();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to clear credentials' });
  });
});
