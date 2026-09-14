import { afterEach, describe, expect, it, vi } from 'vitest';
import { oauthStateCookieOptions, sessionCookieOptions } from './sessionCookie';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sessionCookieOptions', () => {
  it('is httpOnly, lax and root-scoped with the given maxAge', () => {
    expect(sessionCookieOptions(900)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 900,
      path: '/',
    });
  });

  it('is secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookieOptions(900).secure).toBe(true);
  });
});

describe('oauthStateCookieOptions', () => {
  it('lives 600 seconds, lax', () => {
    expect(oauthStateCookieOptions()).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' });
  });
});
