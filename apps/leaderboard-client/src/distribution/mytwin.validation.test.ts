import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlatformRegistry } from '../../../../packages/registry/platform';
import { eligibleDeliverableType, flowsValidating } from '../../../../packages/capabilities/deliverables';
import { platform } from './mytwin.platform';
import { flowCatalog } from './mytwin.flows';
import { formTypeOf, isValidationFlow, validationModeOf } from './mytwin.validation';

describe('distribution MyTwin — validation', () => {
  beforeEach(() => {
    PlatformRegistry.reset();
    PlatformRegistry.install(platform);
  });
  afterEach(() => PlatformRegistry.reset());

  it('lets each validation flow test the deliverables of its historical source, and only those', () => {
    expect(flowsValidating('ml')).toEqual(['endpoint-validation']);
    expect(flowsValidating('code')).toEqual(['journey-validation']);
    expect(eligibleDeliverableType('endpoint-validation', 'ml')).toBe('api_packaging');
    expect(eligibleDeliverableType('journey-validation', 'code')).toBe('project');
    expect(eligibleDeliverableType('endpoint-validation', 'code')).toBeNull();
  });

  it('knows the mode of every installed validation flow', () => {
    const validationFlows = PlatformRegistry.flows()
      .filter((flow) => flow.requires)
      .map((flow) => flow.descriptor.key);

    expect(validationFlows.map(validationModeOf)).toEqual(['reference_case', 'scenario']);
    expect(validationModeOf('code')).toBeNull();
    expect(validationModeOf('validation')).toBeNull();
  });

  it('maps every flow onto an entry of the type selector', () => {
    expect(flowCatalog.list().map((descriptor) => formTypeOf(descriptor.key))).toEqual([
      'code',
      'ml',
      'validation',
      'validation',
    ]);
    expect(isValidationFlow(undefined)).toBe(false);
  });
});
