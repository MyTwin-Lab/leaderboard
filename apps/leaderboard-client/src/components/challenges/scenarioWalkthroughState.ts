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
 * bouton gris muet. Les étapes manquantes passent avant le retour global —
 * c'est le trou le plus coûteux à combler, autant l'annoncer en premier.
 */
export function finishBlocker(steps: WalkthroughStepView[], globalFeedback: string): string | null {
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
  cpPerValidation: number
): string {
  return finishBlocker(steps, globalFeedback) ?? `Pays ${cpPerValidation} CP from the remaining pool`;
}
