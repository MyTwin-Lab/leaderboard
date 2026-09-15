import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlatformRegistry } from '../../../../packages/registry/platform';
import { flowsValidating } from '../../../../packages/capabilities/deliverables';
import { DEFAULT_CODE_REWARD_RULES } from '../../../../packages/database-service/domain/codeRewardRules';
import { platform } from './mytwin.platform';
import { flowCatalog } from './mytwin.flows';
import type { FlowFormContext } from '@/lib/flowFormSlots';
import { formLogicFor, formLogics } from './forms';
import { codeFormLogic } from './forms/code';
import { mlFormLogic } from './forms/ml';
import { VALIDATION_FLOW_BY_SOURCE, validationFormLogic } from './forms/validation';
import { sandboxKindOf, sandboxKinds } from './forms/sandbox';

const create: FlowFormContext = { mode: 'create', pool: 100, open: true };
const edit = (challenge: Record<string, unknown>): FlowFormContext => ({
  mode: 'edit',
  pool: 100,
  open: true,
  challenge: { uuid: 'c-1', title: 'T', slug: 't', status: 'active', type: 'code', contribution_points_reward: 100, project_id: 'p-1', ...challenge },
});
const promotion = (type: string, goals: string[] = []): FlowFormContext => ({
  mode: 'promotion',
  pool: 100,
  open: true,
  promotion: { uuid: 's-1', title: 'S', slug: 's', type, goals },
});

describe('distribution MyTwin — challenge forms', () => {
  beforeEach(() => {
    PlatformRegistry.reset();
    PlatformRegistry.install(platform);
  });
  afterEach(() => PlatformRegistry.reset());

  it('resolves a validation flow per source exactly as the declared deliverables do', () => {
    for (const descriptor of flowCatalog.list()) {
      const candidates = flowsValidating(descriptor.key);
      expect(VALIDATION_FLOW_BY_SOURCE[descriptor.key] ?? null).toBe(candidates.length === 1 ? candidates[0] : null);
    }
  });

  it('gives every installed flow an entry of the type selector', () => {
    expect(flowCatalog.list().map((descriptor) => formLogicFor(descriptor.key).key)).toEqual([
      'code',
      'ml',
      'validation',
      'validation',
    ]);
    expect(formLogics.map((logic) => logic.key)).toEqual(['code', 'ml', 'validation']);
  });
});

describe('code form section', () => {
  it('creates a code challenge with its workspace mode, and its repo only in shared-repo mode', () => {
    const state = { ...codeFormLogic.initialState(create), githubRepo: ' https://github.com/acme/app ' };

    expect(codeFormLogic.body(state, create)).toEqual({
      type: 'code',
      reward_rules: DEFAULT_CODE_REWARD_RULES,
      compute_enabled: false,
      workspace_mode: 'provided_repo',
      github_repo: 'https://github.com/acme/app',
    });
    expect(codeFormLogic.body({ ...state, workspaceMode: 'own_repo' }, create).github_repo).toBeUndefined();
  });

  it('edits only the rules, and reads the stored workspace mode', () => {
    const ctx = edit({ flow_config: { workspace_mode: 'own_repo' } });
    const state = codeFormLogic.initialState(ctx);

    expect(state.workspaceMode).toBe('own_repo');
    expect(codeFormLogic.body(state, ctx)).toEqual({ reward_rules: DEFAULT_CODE_REWARD_RULES, compute_enabled: false });
  });

  it('promotes into own_repo with the proposal goals as template tasks, sending neither type nor repo', () => {
    const ctx = promotion('code', ['Collect data', 'Train']);
    const state = codeFormLogic.initialState(ctx);

    expect(state.workspaceMode).toBe('own_repo');
    expect(state.pendingTasks.map((t) => t.title)).toEqual(['Collect data', 'Train']);
    expect(codeFormLogic.body(state, ctx)).not.toHaveProperty('type');
    expect(codeFormLogic.body(state, ctx)).not.toHaveProperty('github_repo');
  });
});

describe('ML form section', () => {
  it('creates with the API packaging step, edits without it', () => {
    const state = { ...mlFormLogic.initialState(create), computeEnabled: true, apiPackagingEnabled: false };

    expect(mlFormLogic.body(state, create)).toMatchObject({ type: 'ml', compute_enabled: true, api_packaging_enabled: false });
    expect(mlFormLogic.body(state, edit({ type: 'ml' }))).not.toHaveProperty('api_packaging_enabled');
    expect(mlFormLogic.body(state, promotion('ml'))).toMatchObject({ compute_enabled: true, api_packaging_enabled: false });
    expect(mlFormLogic.body(state, promotion('ml'))).not.toHaveProperty('type');
  });

  it('reads the compute setting from the extension section of the configuration', () => {
    const state = mlFormLogic.initialState(edit({ type: 'ml', flow_config: { extensions: { compute: { enabled: true } } } }));
    expect(state.computeEnabled).toBe(true);
  });
});

describe('validation form section', () => {
  it('requires a source whose deliverables a validation flow can test, at creation only', () => {
    const state = validationFormLogic.initialState(create);

    expect(validationFormLogic.validate!(state, create)).toMatch(/source challenge/);
    expect(validationFormLogic.validate!({ ...state, sourceChallengeId: 'src', sourceType: 'code' }, create)).toBeNull();
    expect(validationFormLogic.validate!(state, edit({ type: 'endpoint-validation' }))).toBeNull();
  });

  it('sends the flow the source decides, with a quorum only for endpoint validation', () => {
    const state = { ...validationFormLogic.initialState(create), sourceChallengeId: 'src', cpPerValidation: 7, requiredValidations: 5 };

    expect(validationFormLogic.body({ ...state, sourceType: 'ml' }, create)).toMatchObject({
      type: 'endpoint-validation',
      source_challenge_id: 'src',
      cp_per_validation: 7,
      required_validations: 5,
    });
    const journey = validationFormLogic.body({ ...state, sourceType: 'code' }, create);
    expect(journey.type).toBe('journey-validation');
    expect(journey.required_validations).toBeUndefined();
  });

  it('reads the locked values of an existing validation challenge', () => {
    const ctx = edit({ type: 'journey-validation', source_challenge_id: 'src', flow_config: { cp_per_validation: 12 } });
    const state = validationFormLogic.initialState(ctx);

    expect(state).toMatchObject({ sourceChallengeId: 'src', cpPerValidation: 12 });
    expect(validationFormLogic.body(state, ctx)).toEqual({ reward_rules: null, compute_enabled: false });
  });
});

describe('sandbox kinds', () => {
  it('asks for a dataset and a model only on a proposal that becomes an ML challenge', () => {
    expect(sandboxKinds.map((kind) => [kind.key, kind.artifacts])).toEqual([['code', false], ['ml', true]]);
    expect(sandboxKindOf('unknown').key).toBe('code');
  });
});
