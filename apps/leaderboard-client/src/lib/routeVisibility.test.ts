import { describe, expect, it } from 'vitest';
import { isPublicPage, isPublicApiRoute } from './routeVisibility';

// proxy.ts gates by prefix, and the prefix `/challenges/` covers both the
// detail page and its `/manage` sub-page. These allowlists are what lets the
// first through while the second stays admin-only, so the manage cases below
// are the point of the whole module.
describe('isPublicPage', () => {
  it('opens the challenge detail page', () => {
    expect(isPublicPage('/challenges/abc-123')).toBe(true);
  });

  it('tolerates a trailing slash', () => {
    expect(isPublicPage('/challenges/abc-123/')).toBe(true);
  });

  it('keeps the manage sub-page closed', () => {
    expect(isPublicPage('/challenges/abc-123/manage')).toBe(false);
  });

  it('does not open the challenges list to the rule', () => {
    expect(isPublicPage('/challenges')).toBe(false);
  });

  it('keeps unrelated pages closed', () => {
    expect(isPublicPage('/admin')).toBe(false);
    expect(isPublicPage('/contributors/me')).toBe(false);
  });
});

describe('isPublicApiRoute', () => {
  it('opens exactly the three read routes', () => {
    expect(isPublicApiRoute('/api/challenges/abc/overview')).toBe(true);
    expect(isPublicApiRoute('/api/challenges/abc/repo-activity')).toBe(true);
    expect(isPublicApiRoute('/api/challenges/abc/ml-rewards')).toBe(true);
  });

  it('keeps every mutating or sensitive sibling closed', () => {
    for (const route of [
      '/api/challenges/abc/join',
      '/api/challenges/abc/close',
      '/api/challenges/abc/sync',
      '/api/challenges/abc/workspace',
      '/api/challenges/abc/project-evaluation',
      '/api/challenges/abc/validation-runs',
      '/api/challenges/abc/compute-requests',
      '/api/challenges/abc/documents',
      '/api/challenges/abc/team',
      '/api/challenges/abc/repos',
    ]) {
      expect(isPublicApiRoute(route)).toBe(false);
    }
  });

  it('does not open a deeper path that merely starts with an open one', () => {
    expect(isPublicApiRoute('/api/challenges/abc/overview/secret')).toBe(false);
  });

  it('keeps the challenges collection route closed', () => {
    expect(isPublicApiRoute('/api/challenges')).toBe(false);
  });
});
