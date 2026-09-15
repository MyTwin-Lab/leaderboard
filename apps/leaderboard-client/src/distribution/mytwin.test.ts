import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlatformRegistry } from '../../../../packages/registry/platform';
import { flowCatalog } from './mytwin.flows';
import { platform } from './mytwin.platform';

/** Les clés déjà écrites dans les ledgers existants : chacune doit garder un propriétaire. */
const HISTORICAL_RULE_KEYS = [
  'api_packaging',
  'beat_best',
  'code_fixed',
  'code_quality',
  'dataset',
  'model_code',
  'model_metric',
  'reuse_dataset',
  'reuse_model',
  'slack_signal',
  'validation',
];

describe('distribution MyTwin', () => {
  beforeEach(() => PlatformRegistry.reset());
  afterEach(() => PlatformRegistry.reset());

  it('installs without any rule key or contribution type claimed twice', () => {
    expect(() => PlatformRegistry.install(platform)).not.toThrow();
  });

  it('catalogues exactly the flows the server installs', () => {
    expect(flowCatalog.list()).toEqual(platform.flows.map((flow) => flow.descriptor));
  });

  it('gives an owner to every rule key already written in existing ledgers', () => {
    PlatformRegistry.install(platform);

    expect(PlatformRegistry.ruleKeys().map((ruleKey) => ruleKey.key).sort()).toEqual(HISTORICAL_RULE_KEYS);
  });

  it('keeps only the Slack signals out of the pool', () => {
    PlatformRegistry.install(platform);

    expect(PlatformRegistry.ruleKeys().filter((ruleKey) => !ruleKey.consumesPool).map((ruleKey) => ruleKey.key))
      .toEqual(['slack_signal']);
  });
});
