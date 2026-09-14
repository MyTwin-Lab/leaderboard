import { describe, it, expect } from 'vitest';
import { isUuid, parseSessionClaims } from './sessionClaims';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('parseSessionClaims', () => {
  it('accepts an access token of the expected type', () => {
    expect(parseSessionClaims({ userId: USER_ID, role: 'contributor', typ: 'access' }, 'access'))
      .toEqual({ userId: USER_ID, role: 'contributor' });
  });

  it('rejects the anonymous sb_anon payload', () => {
    expect(parseSessionClaims({ aid: USER_ID }, 'access')).toBeNull();
  });

  it('rejects a refresh token used as an access token, and the reverse', () => {
    expect(parseSessionClaims({ userId: USER_ID, role: 'admin', typ: 'refresh' }, 'access')).toBeNull();
    expect(parseSessionClaims({ userId: USER_ID, role: 'admin', typ: 'access' }, 'refresh')).toBeNull();
  });

  it('tolerates a token issued before typ existed', () => {
    expect(parseSessionClaims({ userId: USER_ID, role: 'admin' }, 'access'))
      .toEqual({ userId: USER_ID, role: 'admin' });
  });

  it('rejects a userId that is not a UUID', () => {
    expect(parseSessionClaims({ userId: 'undefined', role: 'admin' }, 'access')).toBeNull();
    expect(parseSessionClaims({ userId: 42, role: 'admin' }, 'access')).toBeNull();
  });

  it('rejects a missing or empty role', () => {
    expect(parseSessionClaims({ userId: USER_ID }, 'access')).toBeNull();
    expect(parseSessionClaims({ userId: USER_ID, role: '' }, 'access')).toBeNull();
  });
});

describe('isUuid', () => {
  it('only accepts canonical UUID strings', () => {
    expect(isUuid(USER_ID)).toBe(true);
    expect(isUuid('undefined')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
