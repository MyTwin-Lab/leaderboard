import { z } from "zod";
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
} from "../../../../packages/services/challenge/scenario-errors.js";

/**
 * Traduit les erreurs typées de `ScenarioStepsService` et de
 * `ScenarioWalkthroughService` en réponses HTTP.
 *
 * Les règles (gel du scénario, renumérotation, propriété d'une walkthrough,
 * état brouillon/complété, paiement et sa protection contre la course) sont
 * portées par les services et testées là-bas ; les actions ne les rejouent
 * pas, elles se contentent de cette table de correspondance — écrite une
 * seule fois pour que plusieurs actions ne divergent pas sur le code renvoyé
 * pour la même situation.
 *
 * IncompleteWalkthroughError sort avec `missingStepIds` : le client allume
 * les points concernés dans la barre de progression au lieu de laisser le
 * validateur chercher lesquels il a sautés. Elle passe donc avant les
 * branches génériques, puisqu'elle seule renvoie un corps que les autres
 * n'ont pas.
 *
 * Renvoie `null` quand l'erreur n'est pas une erreur métier du scénario.
 */
export function scenarioErrorResponse(error: unknown): Response | null {
  const json = (status: number) => Response.json({ error: (error as Error).message }, { status });

  if (error instanceof IncompleteWalkthroughError) {
    return Response.json({ error: error.message, missingStepIds: error.missingStepIds }, { status: 400 });
  }
  if (error instanceof SelfWalkthroughError) return json(403);
  if (error instanceof ForbiddenRunAccessError) return json(403);
  if (error instanceof MedicalCommentForbiddenError) return json(403);
  if (error instanceof ValidatorRoleError) return json(403);
  if (error instanceof RunNotFoundError) return json(404);
  if (error instanceof StepNotFoundError) return json(404);
  if (error instanceof RunAlreadyCompletedError) return json(409);
  if (error instanceof ScenarioFrozenError) return json(409);
  if (error instanceof GlobalFeedbackRequiredError) return json(400);
  if (error instanceof EmptyScenarioError) return json(400);
  if (error instanceof TargetNotExposedError) return json(400);
  if (error instanceof ScenarioModeError) return json(400);
  return null;
}

/**
 * La réponse d'une erreur attendue : un corps invalide (400) ou une erreur
 * métier du scénario. Toute autre erreur est relancée, et le dispatcher la
 * relaie en 500 sans la masquer.
 */
export function relayScenarioError(error: unknown, invalidBodyMessage = "Validation error"): Response {
  if (error instanceof z.ZodError) {
    return Response.json({ error: invalidBodyMessage, details: error.issues }, { status: 400 });
  }
  const mapped = scenarioErrorResponse(error);
  if (mapped) return mapped;
  throw error;
}
