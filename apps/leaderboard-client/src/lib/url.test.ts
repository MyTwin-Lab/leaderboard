import { afterEach, describe, expect, it } from 'vitest';
import { getInternalBaseUrl, safeInternalPath } from './url';

/**
 * safeInternalPath() gates every "come back here after Google" redirect
 * (/signin, /api/google-auth/authorize). Anything it lets through ends up in a
 * Location header, so an escape means an open redirect: an attacker sends
 * /signin?from=//evil.com, the victim signs in for real, and Google hands the
 * session back on the attacker's domain.
 */
describe('safeInternalPath', () => {
  it('keeps a plain internal path', () => {
    expect(safeInternalPath('/contributors/me')).toBe('/contributors/me');
  });

  it('keeps the root path', () => {
    expect(safeInternalPath('/')).toBe('/');
  });

  it('falls back to / when the path is missing', () => {
    expect(safeInternalPath(null)).toBe('/');
  });

  it('falls back to / on an empty string', () => {
    expect(safeInternalPath('')).toBe('/');
  });

  it('rejects a protocol-relative URL pointing off-site', () => {
    expect(safeInternalPath('//evil.com')).toBe('/');
  });

  it('rejects an absolute URL pointing off-site', () => {
    expect(safeInternalPath('https://evil.com')).toBe('/');
  });

  it('rejects a path that is not anchored at the root', () => {
    expect(safeInternalPath('contributors/me')).toBe('/');
  });

  it('rejects traversal segments', () => {
    expect(safeInternalPath('/../admin')).toBe('/');
  });

  it('rejects a path carrying a query string', () => {
    expect(safeInternalPath('/challenges?id=1')).toBe('/');
  });

  // Le seul query admis : le jeton d'une invitation de groupe, pour qu'un
  // visiteur non connecté le retrouve après Google.
  it('keeps a group invitation link', () => {
    const invite = '/challenges/mykine?group=8e53bee5-27d0-483d-9adf-091e5df9f2e8';
    expect(safeInternalPath(invite)).toBe(invite);
  });

  it.each([
    ['a token that is not a uuid', '/challenges/mykine?group=abc'],
    ['anything after the token', '/challenges/mykine?group=8e53bee5-27d0-483d-9adf-091e5df9f2e8&next=//evil.com'],
    ['another query key', '/challenges/mykine?from=8e53bee5-27d0-483d-9adf-091e5df9f2e8'],
    ['a group token outside a challenge page', '/contributors/me?group=8e53bee5-27d0-483d-9adf-091e5df9f2e8'],
    ['a nested challenge path', '/challenges/mykine/manage?group=8e53bee5-27d0-483d-9adf-091e5df9f2e8'],
  ])('rejects %s', (_label, raw) => {
    expect(safeInternalPath(raw)).toBe('/');
  });

  it('rejects a path carrying a fragment', () => {
    expect(safeInternalPath('/challenges#top')).toBe('/');
  });

  it('rejects a backslash-escaped host', () => {
    expect(safeInternalPath('/\\evil.com')).toBe('/');
  });

  // docs/temp.md, M3 : ces formes passaient l'ancienne regex et
  // `//1311768467/x` se résout en https://78.47.255.147/x.
  it.each(['//1311768467/x', '///x', '//localhost'])('rejects the protocol-relative host %s', (raw) => {
    expect(safeInternalPath(raw)).toBe('/');
  });
});

describe('getInternalBaseUrl', () => {
  const saved = { INTERNAL_APP_URL: process.env.INTERNAL_APP_URL, PORT: process.env.PORT };

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('prefers INTERNAL_APP_URL', () => {
    process.env.INTERNAL_APP_URL = 'http://app.internal:8080';
    process.env.PORT = '4000';
    expect(getInternalBaseUrl()).toBe('http://app.internal:8080');
  });

  it('falls back to the loopback on PORT', () => {
    delete process.env.INTERNAL_APP_URL;
    process.env.PORT = '4000';
    expect(getInternalBaseUrl()).toBe('http://127.0.0.1:4000');
  });

  it('defaults to port 3000', () => {
    delete process.env.INTERNAL_APP_URL;
    delete process.env.PORT;
    expect(getInternalBaseUrl()).toBe('http://127.0.0.1:3000');
  });
});
