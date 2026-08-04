import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockEncryptToken, mockTestConnection, mockUpdateScalewayConnection,
  mockRequestScalewayDisconnect, mockVerifyRequestToken,
} = vi.hoisted(() => ({
  mockEncryptToken: vi.fn(),
  mockTestConnection: vi.fn(),
  mockUpdateScalewayConnection: vi.fn(),
  mockRequestScalewayDisconnect: vi.fn(),
  mockVerifyRequestToken: vi.fn(),
}));

vi.mock('../../../../../../../packages/config/scalewayCredentials.js', () => ({
  encryptToken: mockEncryptToken,
}));

vi.mock('../../../../../../../packages/scaleway/index.js', () => ({
  ScalewayClient: class {
    testConnection = mockTestConnection;
  },
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    updateScalewayConnection = mockUpdateScalewayConnection;
    requestScalewayDisconnect = mockRequestScalewayDisconnect;
  },
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

import { POST, DELETE } from './route';

function postConnection(body: unknown) {
  const req = new NextRequest('http://localhost/api/scaleway/connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

function postInvalidJson() {
  const req = new NextRequest('http://localhost/api/scaleway/connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not valid json',
  });
  return POST(req);
}

function deleteConnection() {
  const req = new NextRequest('http://localhost/api/scaleway/connection', {
    method: 'DELETE',
  });
  return DELETE(req);
}

const validBody = { secret_key: 'sk-secret', project_id: 'proj-1', zone: 'fr-par-1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockTestConnection.mockResolvedValue(true);
  mockEncryptToken.mockReturnValue({ enc: 'enc-value', iv: 'iv-value' });
  mockUpdateScalewayConnection.mockResolvedValue(undefined);
  mockRequestScalewayDisconnect.mockResolvedValue(undefined);
});

describe('POST /api/scaleway/connection', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await postConnection(validBody);

    expect(res.status).toBe(401);
    expect(mockTestConnection).not.toHaveBeenCalled();
  });

  it('returns 401 when authenticated but not admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });

    const res = await postConnection(validBody);

    expect(res.status).toBe(401);
    expect(mockTestConnection).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON body', async () => {
    const res = await postInvalidJson();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await postConnection({ secret_key: '', project_id: 'proj-1', zone: 'fr-par-1' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'secret_key, project_id and zone are required' });
    expect(mockTestConnection).not.toHaveBeenCalled();
  });

  it('returns 400 when the Scaleway credentials are invalid', async () => {
    mockTestConnection.mockResolvedValue(false);

    const res = await postConnection(validBody);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid Scaleway credentials or zone' });
    expect(mockUpdateScalewayConnection).not.toHaveBeenCalled();
  });

  it('returns 502 when the Scaleway API cannot be reached', async () => {
    mockTestConnection.mockRejectedValue(new Error('network error'));

    const res = await postConnection(validBody);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Could not reach Scaleway API' });
  });

  it('returns 500 when saving the credentials fails', async () => {
    mockUpdateScalewayConnection.mockRejectedValue(new Error('db down'));

    const res = await postConnection(validBody);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to save credentials' });
  });

  it('saves the encrypted credentials and returns success', async () => {
    const res = await postConnection(validBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockEncryptToken).toHaveBeenCalledWith('sk-secret');
    expect(mockUpdateScalewayConnection).toHaveBeenCalledWith({
      scaleway_secret_key_enc: 'enc-value',
      scaleway_secret_key_iv: 'iv-value',
      scaleway_project_id: 'proj-1',
      scaleway_zone: 'fr-par-1',
      scaleway_connected_by: 'admin-1',
    });
  });
});

describe('DELETE /api/scaleway/connection', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    const res = await deleteConnection();

    expect(res.status).toBe(401);
    expect(mockRequestScalewayDisconnect).not.toHaveBeenCalled();
  });

  it('returns 401 when authenticated but not admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });

    const res = await deleteConnection();

    expect(res.status).toBe(401);
  });

  it('disconnects and returns success', async () => {
    const res = await deleteConnection();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockRequestScalewayDisconnect).toHaveBeenCalled();
  });

  it('returns 500 when the disconnect fails', async () => {
    mockRequestScalewayDisconnect.mockRejectedValue(new Error('db down'));

    const res = await deleteConnection();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to disconnect' });
  });
});
