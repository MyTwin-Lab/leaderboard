import { describe, it, expect } from 'vitest';
import { flowSlots } from './mytwin.client';
import { flowCatalog } from './mytwin.flows';

describe('flowSlots', () => {
  it('gives every installed flow its own slots', () => {
    const slots = flowCatalog.list().map(descriptor => flowSlots(descriptor.key));

    expect(new Set(slots).size).toBe(flowCatalog.list().length);
    for (const slot of slots) {
      expect(typeof slot.contributorTabs).toBe('function');
      expect(typeof slot.manageTabs).toBe('function');
      expect(slot.rulesView).toBeDefined();
    }
  });

  it('falls back on the default flow for a missing or unknown type', () => {
    expect(flowSlots(null)).toBe(flowSlots(flowCatalog.defaultKey));
    expect(flowSlots('retired-flow')).toBe(flowSlots(flowCatalog.defaultKey));
  });
});
