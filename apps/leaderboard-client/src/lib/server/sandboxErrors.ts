import { NextResponse } from "next/server";
import {
  InvalidRewardRulesError,
  SandboxForbiddenError,
  SandboxNotFoundError,
  SandboxNotOpenError,
  SelfStarError,
  StarRateLimitedError,
} from "../../../../../packages/services/sandbox";
import { slugTakenResponse } from "./slugs";

/**
 * Traduit les erreurs typées de `SandboxService` en réponses HTTP.
 *
 * Les règles (auteur, statut, débit) sont portées par le service et testées
 * là-bas ; les routes ne les rejouent pas, elles se contentent de cette table
 * de correspondance — écrite une seule fois pour que deux routes ne divergent
 * pas sur le code renvoyé pour la même situation.
 *
 * Renvoie `null` quand l'erreur n'est pas une erreur métier du sandbox :
 * l'appelant la relaie alors en 500, sans la masquer.
 */
export function sandboxErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof SandboxNotFoundError) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }
  // 403 et non 409 : le refus vise la personne (l'auteur), pas l'état du sandbox.
  if (error instanceof SelfStarError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SandboxForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  // 409 : le sandbox n'est plus `open`. L'appelant a le droit, l'objet non.
  if (error instanceof SandboxNotOpenError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  // Le message invite à se connecter — c'est la sortie d'un vrai utilisateur
  // derrière une IP partagée (campus, entreprise) qui atteindrait le plafond.
  if (error instanceof StarRateLimitedError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  // Promotion : des règles de reward que le flow du challenge ne sait pas lire.
  if (error instanceof InvalidRewardRulesError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // Création, édition et promotion : un slug pris répond comme sur les challenges.
  return slugTakenResponse(error);
}
