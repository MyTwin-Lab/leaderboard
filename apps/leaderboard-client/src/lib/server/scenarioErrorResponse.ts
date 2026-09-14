import { NextResponse } from "next/server";
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
} from "../../../../../packages/services/challenge/scenario-errors";

/**
 * Traduit les erreurs typées de `ScenarioStepsService` et de
 * `ScenarioWalkthroughService` en réponses HTTP.
 *
 * Les règles (gel du scénario, renumérotation, propriété d'une walkthrough,
 * état brouillon/complété, paiement et sa protection contre la course) sont
 * portées par les services et testées là-bas ; les routes ne les rejouent
 * pas, elles se contentent de cette table de correspondance — écrite une
 * seule fois pour que plusieurs routes ne divergent pas sur le code renvoyé
 * pour la même situation.
 *
 * IncompleteWalkthroughError sort avec `missingStepIds` : le client allume
 * les points concernés dans la barre de progression au lieu de laisser le
 * validateur chercher lesquels il a sautés. Elle passe donc avant les
 * branches génériques, puisqu'elle seule renvoie un corps que les autres
 * n'ont pas.
 *
 * Renvoie `null` quand l'erreur n'est pas une erreur métier du scénario :
 * l'appelant la relaie alors en 500, sans la masquer.
 */
export function scenarioErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof IncompleteWalkthroughError) {
    return NextResponse.json({ error: error.message, missingStepIds: error.missingStepIds }, { status: 400 });
  }
  if (error instanceof SelfWalkthroughError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ForbiddenRunAccessError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof MedicalCommentForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RunNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof StepNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof RunAlreadyCompletedError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ScenarioFrozenError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof GlobalFeedbackRequiredError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof EmptyScenarioError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof TargetNotExposedError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ScenarioModeError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}
