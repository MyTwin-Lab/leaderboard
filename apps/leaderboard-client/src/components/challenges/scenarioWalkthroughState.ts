import type { ScenarioResult } from './scenarioResult';

/** Une étape telle que l'écran de walkthrough la manipule : le scénario + ma réponse. */
export interface WalkthroughStepView {
  stepId: string;
  position: number;
  title: string;
  instructions: string | null;
  result: ScenarioResult | null;
  comment: string | null;
  medicalComment: string | null;
}

/**
 * Où ouvrir une walkthrough : sur la première étape sans résultat.
 *
 * Reprendre un brouillon à l'étape 1 obligerait à recliquer sur tout ce qui
 * est déjà répondu — exactement le travail que le brouillon devait épargner.
 * Tout répondu : on se pose sur la dernière, d'où l'écran final est à un clic.
 */
export function firstUnansweredIndex(steps: WalkthroughStepView[]): number {
  if (steps.length === 0) return 0;
  const index = steps.findIndex(s => s.result === null);
  return index === -1 ? steps.length - 1 : index;
}

/**
 * Pourquoi « Finish » est désactivé, ou null s'il ne l'est pas.
 *
 * Le bouton dit *pourquoi* : « 2 steps still have no result » plutôt qu'un
 * bouton gris muet. Un enregistrement raté passe avant tout le reste : une
 * étape répondue mais jamais parvenue au serveur est le trou le moins
 * récupérable — la relire ne le révèle pas, le texte est toujours là à
 * l'écran. Les étapes manquantes passent ensuite, avant le retour global —
 * c'est le trou le plus coûteux à combler parmi ce qui reste.
 */
export function finishBlocker(
  steps: WalkthroughStepView[],
  globalFeedback: string,
  unsavedCount: number
): string | null {
  if (unsavedCount === 1) return '1 step could not be saved — retry before finishing';
  if (unsavedCount > 1) return `${unsavedCount} steps could not be saved — retry before finishing`;
  const missing = steps.filter(s => s.result === null).length;
  if (missing === 1) return '1 step still has no result';
  if (missing > 1) return `${missing} steps still have no result`;
  if (!globalFeedback.trim()) return 'The overall feedback is required';
  return null;
}

/** La ligne sous le bouton : soit l'obstacle, soit ce que la walkthrough rapporte. */
export function finishHint(
  steps: WalkthroughStepView[],
  globalFeedback: string,
  cpPerValidation: number,
  unsavedCount: number
): string {
  return finishBlocker(steps, globalFeedback, unsavedCount) ?? `Pays ${cpPerValidation} CP from the remaining pool`;
}

function stepContentEqual(a: WalkthroughStepView, b: WalkthroughStepView): boolean {
  return a.result === b.result && a.comment === b.comment && a.medicalComment === b.medicalComment;
}

/**
 * Fusionne le snapshot renvoyé par le serveur après l'enregistrement d'une
 * étape avec l'état local, étape par étape plutôt qu'en remplaçant tout le
 * tableau.
 *
 * Un commentaire tapé sur une étape sans résultat n'est jamais PUT (l'étape
 * n'a rien à enregistrer tant qu'aucun résultat n'est choisi) : sans cette
 * fusion, l'enregistrement réussi d'une AUTRE étape écrasait ce texte avec le
 * snapshot serveur, qui ne l'a jamais vu passer. Ici, une étape dont le local
 * diverge encore de ce qu'on sait confirmé (ni la réponse du serveur, ni
 * l'étape qu'on vient d'enregistrer) survit intacte ; toutes les autres
 * prennent la version serveur, la plus à jour qu'on ait.
 */
export function mergeStepsAfterSave(
  local: WalkthroughStepView[],
  confirmed: WalkthroughStepView[],
  serverSteps: WalkthroughStepView[],
  justSavedStepId: string
): WalkthroughStepView[] {
  const confirmedById = new Map(confirmed.map(s => [s.stepId, s]));
  const localById = new Map(local.map(s => [s.stepId, s]));
  return serverSteps.map(serverStep => {
    if (serverStep.stepId === justSavedStepId) return serverStep;
    const localStep = localById.get(serverStep.stepId);
    const confirmedStep = confirmedById.get(serverStep.stepId);
    if (localStep && confirmedStep && !stepContentEqual(localStep, confirmedStep)) {
      return localStep;
    }
    return serverStep;
  });
}
