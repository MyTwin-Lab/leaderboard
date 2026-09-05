/**
 * Planification du digest — la décision, sans I/O.
 *
 * Il n'y a pas de cron à fréquence dynamique dans le projet : le cron tourne
 * tous les jours (même modèle que slack-signals) et c'est ici qu'on décide s'il
 * y a lieu de générer.
 *
 * Voir docs/input/spec-digest.md §6 et §7.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minuit UTC du jour de `d`. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Un digest est-il dû ?
 *
 * La comparaison se fait en journées UTC entières, pas en timestamps : un
 * `period_end` posé à 06:00:03 et un cron qui repasse à 06:00:00 sept jours
 * plus tard sont à 6 j 23 h 59 min 57 s l'un de l'autre. Sur des timestamps, le
 * digest serait jugé « pas encore dû » et glisserait d'un jour — à chaque
 * cycle, jusqu'à ce qu'un digest hebdomadaire tombe un autre jour de la semaine.
 *
 * `lastPeriodEnd` à `null` = aucun digest généré : le premier est toujours dû.
 */
export function isDigestDue(
  lastPeriodEnd: Date | null,
  now: Date,
  frequencyDays: number,
): boolean {
  if (!lastPeriodEnd) return true;
  const elapsedDays =
    (startOfUtcDay(now).getTime() - startOfUtcDay(lastPeriodEnd).getTime()) / DAY_MS;
  return elapsedDays >= frequencyDays;
}

/**
 * Les bornes du digest à générer.
 *
 * Contrairement à la décision ci-dessus, les bornes sont des timestamps
 * exacts : `period_start` vaut le `period_end` précédent, sans arrondi. C'est
 * ce qui garantit qu'entre deux digests consécutifs il n'y a ni trou ni
 * recouvrement — arrondir ici rouvrirait les deux.
 *
 * Sans digest précédent, la fréquence sert de fenêtre de rattrapage.
 */
export function digestWindow(
  lastPeriodEnd: Date | null,
  now: Date,
  frequencyDays: number,
): { start: Date; end: Date } {
  const start = lastPeriodEnd ?? new Date(now.getTime() - frequencyDays * DAY_MS);
  return { start, end: now };
}
