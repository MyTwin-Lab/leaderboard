import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { SignJWT, decodeJwt } from 'jose';

const {
  mockCreate, mockFindByHash, mockDeleteByHash, mockDeleteAllByUserId, mockShortenExpiry,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindByHash: vi.fn(),
  mockDeleteByHash: vi.fn(),
  mockDeleteAllByUserId: vi.fn(),
  mockShortenExpiry: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

vi.mock('../../../../packages/config', () => ({
  config: { auth: { jwtSecret: 'test-secret', accessExpiry: '15m', refreshExpiry: '7d' } },
}));

vi.mock('../../../../packages/database-service/repositories', () => ({
  RefreshTokenRepository: class {
    create = mockCreate;
    findByHash = mockFindByHash;
    deleteByHash = mockDeleteByHash;
    deleteAllByUserId = mockDeleteAllByUserId;
    shortenExpiry = mockShortenExpiry;
  },
  UserRepository: class {
    findById = vi.fn();
  },
}));

import {
  consumeRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  invalidateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
} from './auth';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('token generation', () => {
  it('signs a refresh token with a random jti and without email', async () => {
    const claims = decodeJwt(await generateRefreshToken({ userId: USER_ID, role: 'contributor', email: 'a@b.com' }));

    expect(claims).toMatchObject({ userId: USER_ID, role: 'contributor', typ: 'refresh' });
    expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(claims).not.toHaveProperty('email');
  });

  it('signs an access token without email or jti', async () => {
    const claims = decodeJwt(await generateAccessToken({ userId: USER_ID, role: 'admin', email: 'a@b.com', jti: 'x' }));

    expect(claims).toMatchObject({ userId: USER_ID, role: 'admin', typ: 'access' });
    expect(claims).not.toHaveProperty('email');
    expect(claims).not.toHaveProperty('jti');
  });
});

describe('verifyRefreshToken', () => {
  it('accepts a freshly issued refresh token', async () => {
    const payload = await verifyRefreshToken(await generateRefreshToken({ userId: USER_ID, role: 'contributor' }));
    expect(payload?.userId).toBe(USER_ID);
    expect(typeof payload?.jti).toBe('string');
  });

  // Jetons émis avant M5 : aucune ligne en base ne peut leur correspondre.
  it('rejects a legacy refresh token without jti', async () => {
    const legacy = await new SignJWT({ userId: USER_ID, role: 'contributor', email: 'a@b.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode('test-secret'));

    expect(await verifyRefreshToken(legacy)).toBeNull();
  });
});

describe('refresh token storage', () => {
  it('stores sha256(jti) with the token expiry', async () => {
    const token = await generateRefreshToken({ userId: USER_ID, role: 'contributor' });
    const { jti, exp } = decodeJwt(token);

    await storeRefreshToken(USER_ID, token);

    expect(mockCreate).toHaveBeenCalledWith({
      user_id: USER_ID,
      token_hash: sha256(jti as string),
      expires_at: new Date((exp as number) * 1000),
    });
  });

  it('invalidates by sha256(jti)', async () => {
    await invalidateRefreshToken('jti-1');
    expect(mockDeleteByHash).toHaveBeenCalledWith(sha256('jti-1'));
  });
});

describe('consumeRefreshToken', () => {
  const payload = { userId: USER_ID, role: 'contributor', jti: 'jti-1' };

  it('accepts a known token and shortens its expiry to the reuse grace window', async () => {
    mockFindByHash.mockResolvedValue({ user_id: USER_ID, expires_at: new Date(Date.now() + 86_400_000) });

    expect(await consumeRefreshToken(payload)).toBe(true);

    expect(mockFindByHash).toHaveBeenCalledWith(sha256('jti-1'));
    expect(mockShortenExpiry).toHaveBeenCalledWith(sha256('jti-1'), expect.any(Date));
    const until = mockShortenExpiry.mock.calls[0][1] as Date;
    expect(until.getTime() - Date.now()).toBeLessThanOrEqual(30_000);
    expect(mockDeleteAllByUserId).not.toHaveBeenCalled();
  });

  it('revokes every session when the token is unknown (revoked or replayed)', async () => {
    mockFindByHash.mockResolvedValue(null);

    expect(await consumeRefreshToken(payload)).toBe(false);

    expect(mockDeleteAllByUserId).toHaveBeenCalledWith(USER_ID);
    expect(mockShortenExpiry).not.toHaveBeenCalled();
  });

  it('revokes every session when the token was rotated past the grace window', async () => {
    mockFindByHash.mockResolvedValue({ user_id: USER_ID, expires_at: new Date(Date.now() - 1000) });

    expect(await consumeRefreshToken(payload)).toBe(false);
    expect(mockDeleteAllByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it('refuses a row belonging to another user', async () => {
    mockFindByHash.mockResolvedValue({
      user_id: '22222222-2222-4222-8222-222222222222',
      expires_at: new Date(Date.now() + 86_400_000),
    });

    expect(await consumeRefreshToken(payload)).toBe(false);
  });
});
