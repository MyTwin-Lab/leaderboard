import { NextResponse } from "next/server";
import {
  ScenarioModeError,
  ScenarioFrozenError,
  StepNotFoundError,
} from "../../../../../packages/services/challenge/scenario-errors";

/**
 * Traduit les erreurs typées de `ScenarioStepsService` en réponses HTTP.
 *
 * Les règles (gel du scénario, renumérotation) sont portées par le service et
 * testées là-bas ; les routes ne les rejouent pas, elles se contentent de
 * cette table de correspondance — écrite une seule fois pour que deux routes
 * ne divergent pas sur le code renvoyé pour la même situation.
 *
 * Renvoie `null` quand l'erreur n'est pas une erreur métier du scénario :
 * l'appelant la relaie alors en 500, sans la masquer.
 */
export function scenarioErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ScenarioFrozenError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof StepNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ScenarioModeError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}
