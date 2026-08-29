import { describe, expect, it } from 'vitest';
import { safeInternalPath } from './url';

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

  it('rejects a path carrying a fragment', () => {
    expect(safeInternalPath('/challenges#top')).toBe('/');
  });

  it('rejects a backslash-escaped host', () => {
    expect(safeInternalPath('/\\evil.com')).toBe('/');
  });
});
