/**
 * Les erreurs du flux scénario, partagées par ScenarioStepsService,
 * ScenarioWalkthroughService et les cinq routes qui les appellent.
 *
 * Regroupées ici pour deux raisons : les deux services lèvent des erreurs
 * communes (mode, étape introuvable), et chaque route veut une seule import
 * pour faire sa table erreur -> statut HTTP.
 */

/** Le challenge n'est pas un challenge de validation en mode scénario. -> 400 */
export class ScenarioModeError extends Error {}

/** Une walkthrough existe déjà : le scénario ne bouge plus. -> 409 */
export class ScenarioFrozenError extends Error {}

/** Aucune étape n'a encore été écrite : il n'y a rien à parcourir. -> 400 */
export class EmptyScenarioError extends Error {}

/** L'étape n'existe pas, ou pas sur ce challenge. -> 404 */
export class StepNotFoundError extends Error {}

/** La walkthrough n'existe pas, ou pas sur ce challenge. -> 404 */
export class RunNotFoundError extends Error {}

/** La walkthrough appartient à quelqu'un d'autre. -> 403 */
export class ForbiddenRunAccessError extends Error {}

/**
 * Le validateur essaie de parcourir sa propre application — en tant que
 * porteur ou en tant que membre du groupe. -> 403
 */
export class SelfWalkthroughError extends Error {}

/** Une walkthrough complétée est immuable. -> 409 */
export class RunAlreadyCompletedError extends Error {}

/** Le retour global est obligatoire à la complétion. -> 400 */
export class GlobalFeedbackRequiredError extends Error {}

/** Un non-medical_pro a envoyé un avis médical. -> 403 */
export class MedicalCommentForbiddenError extends Error {}

/** L'application n'est pas exposée sur ce challenge de validation. -> 400 */
export class TargetNotExposedError extends Error {}

/**
 * Il reste des étapes sans résultat. Porte leurs identifiants pour que le
 * client puisse allumer les points correspondants dans la barre de
 * progression, au lieu de laisser le validateur chercher. -> 400
 */
export class IncompleteWalkthroughError extends Error {
  constructor(message: string, readonly missingStepIds: string[]) {
    super(message);
  }
}
