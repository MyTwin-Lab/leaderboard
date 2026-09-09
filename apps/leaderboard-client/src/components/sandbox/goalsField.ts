/**
 * Le champ « What I want to build » — une ligne par but.
 * ------------------------------------------------------
 * `goals` est un `jsonb string[]` en base, pas un markdown : chaque but est
 * rendu séparément sur la page détail, et ce sont eux qui pré-rempliront les
 * template tasks à la promotion. Le formulaire, lui, reste une simple
 * `<textarea>` — d'où cette paire de fonctions, seul point de conversion.
 *
 * Pur et sans React, donc testable dans l'environnement `node` du dépôt.
 */

/** Le plafond du schéma Zod (`sandboxCreateSchema.goals`), rappelé pour l'UI. */
export const MAX_GOALS = 20;

/** Le plafond par but, lui aussi tiré du schéma. */
export const MAX_GOAL_LENGTH = 500;

/**
 * Une puce que l'auteur aurait tapée à la main. Le texte est du markdown pour
 * lui, une liste pour nous : on retire le marqueur plutôt que de laisser un
 * « - » s'afficher devant la puce déjà rendue par le détail.
 */
const BULLET_PREFIX = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * Le texte de la textarea → le tableau envoyé à l'API.
 *
 * Les lignes vides disparaissent : c'est ce que produit un auteur qui aère sa
 * saisie, et une chaîne vide serait refusée par le schéma (`min(1)`).
 */
export function parseGoals(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(BULLET_PREFIX, "").trim())
    .filter((line) => line.length > 0);
}

/** Le tableau reçu de l'API → le texte de la textarea, en édition. */
export function formatGoals(goals: string[] | null | undefined): string {
  if (!goals || goals.length === 0) return "";
  return goals.join("\n");
}

/**
 * Ce qui empêcherait l'API d'accepter la saisie, ou `null`.
 *
 * Les mêmes bornes que `sandboxCreateSchema`, vérifiées ici pour que l'auteur
 * le sache avant d'envoyer — jamais à sa place : le schéma reste l'autorité.
 */
export function goalsError(goals: string[]): string | null {
  if (goals.length > MAX_GOALS) return `At most ${MAX_GOALS} goals.`;
  if (goals.some((goal) => goal.length > MAX_GOAL_LENGTH)) {
    return `A goal cannot exceed ${MAX_GOAL_LENGTH} characters.`;
  }
  return null;
}
