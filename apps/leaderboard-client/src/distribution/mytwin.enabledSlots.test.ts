import { describe, it, expect } from 'vitest';
import { enabledModuleSlots } from './mytwin.modules';
import { meetingsSlots } from './modules/meetings';
import { sandboxSlots } from './modules/sandbox';
import { watchSlots } from './modules/watch';
import { platform } from './mytwin.platform';

const response = (enabled: boolean) => ({
  modules: [
    { key: 'meetings', label: 'Meetings', description: null, enabled },
    { key: 'sandbox', label: 'Sandbox', description: null, enabled: !enabled },
    { key: 'watch', label: 'Watch', description: null, enabled },
  ],
});

describe('enabledModuleSlots', () => {
  it('renders the slots of an enabled module', () => {
    expect(enabledModuleSlots(response(true))).toEqual([meetingsSlots, watchSlots]);
    expect(enabledModuleSlots(response(false))).toEqual([sandboxSlots]);
  });

  it('renders nothing for a disabled module, nor while the state is unknown', () => {
    expect(enabledModuleSlots(response(false))).not.toContain(meetingsSlots);
    expect(enabledModuleSlots(undefined)).toEqual([]);
    expect(enabledModuleSlots({ modules: [] })).toEqual([]);
  });

  it('hides the public Sandbox entry with its module', () => {
    const nav = (enabled: boolean) => enabledModuleSlots(response(enabled)).flatMap(slot => slot.publicNav ?? []);
    expect(nav(false)).toEqual([{ href: '/sandbox', label: 'Sandbox' }]);
    expect(nav(true)).toEqual([]);
  });

  it('hides the home "Open resources" link with the watch module', () => {
    const home = (enabled: boolean) => enabledModuleSlots(response(enabled)).flatMap(slot => slot.homeLinks ?? []);
    expect(home(true)).toEqual([{ href: '/watch', label: 'Open resources' }]);
    expect(home(false)).toEqual([]);
  });

  it('only gives slots to modules the distribution installs', () => {
    const installed = new Set((platform.modules ?? []).map(module => module.key));
    expect(installed.has(meetingsSlots.key)).toBe(true);
    expect(installed.has(sandboxSlots.key)).toBe(true);
    expect(installed.has(watchSlots.key)).toBe(true);
  });
});
