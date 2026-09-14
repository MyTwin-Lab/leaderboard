import { describe, it, expect } from 'vitest';
import { scenarioErrorResponse } from './scenarioErrorResponse';
import {
  ScenarioModeError,
  ScenarioFrozenError,
  EmptyScenarioError,
  StepNotFoundError,
  RunNotFoundError,
  ForbiddenRunAccessError,
  SelfWalkthroughError,
  RunAlreadyCompletedError,
  GlobalFeedbackRequiredError,
  MedicalCommentForbiddenError,
  TargetNotExposedError,
  IncompleteWalkthroughError,
  ValidatorRoleError,
} from '../../../../../packages/services/challenge/scenario-errors';

// Cinq routes s'accordent sur ce tableau erreur -> statut HTTP. Une classe
// non testée ici est une classe où un 403/404 transposé serait invisible —
// le cas de RunNotFoundError et GlobalFeedbackRequiredError avant ce fichier.
describe('scenarioErrorResponse', () => {
  it('maps IncompleteWalkthroughError to 400 with missingStepIds in the body', async () => {
    const res = scenarioErrorResponse(new IncompleteWalkthroughError('2 steps still have no result', ['step-1', 'step-2']));

    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body).toEqual({ error: '2 steps still have no result', missingStepIds: ['step-1', 'step-2'] });
  });

  it('maps SelfWalkthroughError to 403', async () => {
    const res = scenarioErrorResponse(new SelfWalkthroughError('nope'));
    expect(res!.status).toBe(403);
    expect((await res!.json()).error).toBe('nope');
  });

  it('maps ForbiddenRunAccessError to 403', () => {
    expect(scenarioErrorResponse(new ForbiddenRunAccessError('nope'))!.status).toBe(403);
  });

  it('maps MedicalCommentForbiddenError to 403', () => {
    expect(scenarioErrorResponse(new MedicalCommentForbiddenError('nope'))!.status).toBe(403);
  });

  it('maps ValidatorRoleError to 403', () => {
    expect(scenarioErrorResponse(new ValidatorRoleError('nope'))!.status).toBe(403);
  });

  it('maps RunNotFoundError to 404', () => {
    expect(scenarioErrorResponse(new RunNotFoundError('nope'))!.status).toBe(404);
  });

  it('maps StepNotFoundError to 404', () => {
    expect(scenarioErrorResponse(new StepNotFoundError('nope'))!.status).toBe(404);
  });

  it('maps RunAlreadyCompletedError to 409', () => {
    expect(scenarioErrorResponse(new RunAlreadyCompletedError('nope'))!.status).toBe(409);
  });

  it('maps ScenarioFrozenError to 409', () => {
    expect(scenarioErrorResponse(new ScenarioFrozenError('nope'))!.status).toBe(409);
  });

  it('maps GlobalFeedbackRequiredError to 400', () => {
    expect(scenarioErrorResponse(new GlobalFeedbackRequiredError('nope'))!.status).toBe(400);
  });

  it('maps EmptyScenarioError to 400', () => {
    expect(scenarioErrorResponse(new EmptyScenarioError('nope'))!.status).toBe(400);
  });

  it('maps TargetNotExposedError to 400', () => {
    expect(scenarioErrorResponse(new TargetNotExposedError('nope'))!.status).toBe(400);
  });

  it('maps ScenarioModeError to 400', () => {
    expect(scenarioErrorResponse(new ScenarioModeError('nope'))!.status).toBe(400);
  });

  it('returns null for an error that is not one of the scenario error classes, so the caller relays a 500', () => {
    expect(scenarioErrorResponse(new Error('db down'))).toBeNull();
  });
});
