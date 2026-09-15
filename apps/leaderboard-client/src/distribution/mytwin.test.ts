import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlatformRegistry } from '../../../../packages/registry/platform';
import {
  SANDBOX_EVALUATION_GRID,
  SANDBOX_EVALUATION_HANDLER,
  SANDBOX_EVALUATION_OWNER,
} from '../../../../packages/services/sandbox/sandbox-evaluation.service';
import { ML_ROLE_RULE } from '../../../../packages/services/challenge/mlRoles';
import { CODE_PROJECT_EVALUATION_HANDLER, codeFlowDescriptor } from '../../../../content/flows/code';
import { ML_SUBMISSION_EVALUATION_HANDLER, mlFlowDescriptor } from '../../../../content/flows/ml';
import { flowCatalog } from './mytwin.flows';
import { gridSeeds } from './mytwin.grids';
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

  it('declares a handler for every evaluation the services trace', () => {
    PlatformRegistry.install(platform);

    const origins = [
      [codeFlowDescriptor.key, CODE_PROJECT_EVALUATION_HANDLER],
      [mlFlowDescriptor.key, ML_SUBMISSION_EVALUATION_HANDLER],
      [SANDBOX_EVALUATION_OWNER, SANDBOX_EVALUATION_HANDLER],
    ];
    for (const [owner, handler] of origins) {
      expect(PlatformRegistry.evaluationHandler(owner, handler), `${owner}/${handler}`).toBeDefined();
    }
  });

  it('seeds every grid a flow evaluates with', () => {
    const seeded = gridSeeds.map((seed) => seed.slug);
    const used = [SANDBOX_EVALUATION_GRID, 'code', ...Object.values(ML_ROLE_RULE).map((role) => role.grid)];

    for (const slug of used.filter((grid): grid is string => !!grid)) {
      expect(seeded).toContain(slug);
    }
    for (const seed of gridSeeds) expect(seed.grid.type).toBe(seed.slug);
  });

  it('keeps only the Slack signals out of the pool', () => {
    PlatformRegistry.install(platform);

    expect(PlatformRegistry.ruleKeys().filter((ruleKey) => !ruleKey.consumesPool).map((ruleKey) => ruleKey.key))
      .toEqual(['slack_signal']);
  });
});
