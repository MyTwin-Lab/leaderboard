import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockVerifyRequestToken, mockEncryptToken, mockUpdateSlackConnection, mockClearSlackConnection,
} = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockEncryptToken: vi.fn(),
  mockUpdateSlackConnection: vi.fn(),
  mockClearSlackConnection: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

vi.mock('../../../../../../../packages/config/slackCredentials.js', () => ({
  encryptToken: mockEncryptToken,
}));

vi.mock('../../../../../../../packages/database-service/repositories/index.js', () => ({
  AppSettingsRepository: class {
    updateSlackConnection = mockUpdateSlackConnection;
    clearSlackConnection = mockClearSlackConnection;
  },
}));

import { POST, DELETE } from './route';

function postConnection(body?: unknown, rawBody?: string) {
  const req = new NextRequest('http://localhost/api/slack/connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return POST(req);
}

function deleteConnection() {
  const req = new NextRequest('http://localhost/api/slack/connection', { method: 'DELETE' });
  return DELETE(req);
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  mockVerifyRequestToken.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'a@b.com' });
  mockEncryptToken.mockReturnValue({ enc: 'enc-value', iv: 'iv-value' });
  mockUpdateSlackConnection.mockResolvedValue(undefined);
  mockClearSlackConnection.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({ json: async () => ({ ok: true, team: 'My Team' }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/slack/connection', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await postConnection({ bot_token: 'xoxb-1' });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 401 when authenticated but not admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    const res = await postConnection({ bot_token: 'xoxb-1' });
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON body', async () => {
    const res = await postConnection(undefined, 'not-json');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when bot_token is empty', async () => {
    const res = await postConnection({ bot_token: '   ' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('bot_token is required');
  });

  it('returns 400 when Slack rejects the token', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ ok: false, error: 'invalid_auth' }) });
    const res = await postConnection({ bot_token: 'xoxb-bad' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid Slack token (invalid_auth)');
  });

  it('returns 502 when the Slack API cannot be reached', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const res = await postConnection({ bot_token: 'xoxb-1' });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('Could not reach Slack API');
  });

  it('returns 500 when saving credentials fails', async () => {
    mockUpdateSlackConnection.mockRejectedValue(new Error('db down'));
    const res = await postConnection({ bot_token: 'xoxb-1' });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to save credentials');
  });

  it('saves credentials and returns team_name on success', async () => {
    const res = await postConnection({ bot_token: 'xoxb-1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, team_name: 'My Team' });
    expect(mockEncryptToken).toHaveBeenCalledWith('xoxb-1');
    expect(mockUpdateSlackConnection).toHaveBeenCalledWith({
      slack_token_enc: 'enc-value',
      slack_token_iv: 'iv-value',
      slack_team_name: 'My Team',
      slack_connected_by: 'admin-1',
    });
  });
});

describe('DELETE /api/slack/connection', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    const res = await deleteConnection();
    expect(res.status).toBe(401);
    expect(mockClearSlackConnection).not.toHaveBeenCalled();
  });

  it('returns 401 when authenticated but not admin', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u1', role: 'contributor', email: 'a@b.com' });
    const res = await deleteConnection();
    expect(res.status).toBe(401);
  });

  it('returns 500 when clearing credentials fails', async () => {
    mockClearSlackConnection.mockRejectedValue(new Error('db down'));
    const res = await deleteConnection();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to clear credentials');
  });

  it('clears credentials and returns success', async () => {
    const res = await deleteConnection();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockClearSlackConnection).toHaveBeenCalled();
  });
});
