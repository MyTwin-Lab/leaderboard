import { describe, it, expect, afterEach } from 'vitest';
import { PlatformRegistry } from '../../../../packages/registry/platform';
import { rewardRuleKeySchema } from '../../../../packages/database-service/domain/schemas_zod';
import { flowCatalog } from './mytwin.flows';
import { platform } from './mytwin.platform';

describe('distribution MyTwin', () => {
  afterEach(() => PlatformRegistry.reset());

  it('installs without any rule key or contribution type claimed twice', () => {
    expect(() => PlatformRegistry.install(platform)).not.toThrow();
  });

  it('catalogues exactly the flows the server installs', () => {
    expect(flowCatalog.list()).toEqual(platform.flows.map((flow) => flow.descriptor));
  });

  it('gives every rule key the ledger accepts an owner', () => {
    PlatformRegistry.install(platform);

    expect(PlatformRegistry.ruleKeys().map((ruleKey) => ruleKey.key).sort())
      .toEqual([...rewardRuleKeySchema.options].sort());
  });
});
