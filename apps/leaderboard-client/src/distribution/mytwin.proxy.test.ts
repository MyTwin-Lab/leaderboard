import { describe, it, expect } from 'vitest';
import { config } from '@/proxy';
import { isModuleNonAdminWrite, moduleProtectedApiRoutes, moduleProtectedPages } from './mytwin.proxy';

describe('module routes in the proxy', () => {
  it('keeps every protected module prefix in the static matcher', () => {
    for (const prefix of moduleProtectedApiRoutes) {
      expect(config.matcher).toContain(`${prefix}/:path*`);
    }
  });

  it('keeps every protected module page in the static matcher', () => {
    expect(moduleProtectedPages).toContain('/watch');
    for (const prefix of moduleProtectedPages) {
      expect(config.matcher).toContain(`${prefix}/:path*`);
    }
  });

  it('opens no module write to non-admins under /api/watch', () => {
    expect(isModuleNonAdminWrite('/api/watch/search', 'POST')).toBe(false);
  });

  it('lets a non-admin schedule a meeting, and nothing else under the module', () => {
    expect(isModuleNonAdminWrite('/api/sync-meetings', 'POST')).toBe(true);
    expect(isModuleNonAdminWrite('/api/sync-meetings', 'DELETE')).toBe(false);
    expect(isModuleNonAdminWrite('/api/sync-meetings/m1', 'DELETE')).toBe(false);
  });
});
