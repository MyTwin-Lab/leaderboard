/**
 * Validation des paliers de stars, côté formulaire admin.
 * -------------------------------------------------------
 * `sandboxSettingsPatchSchema` reste l'autorité : cette fonction ne fait que
 * dire à l'admin, avant l'envoi, ce que l'API refuserait — et surtout
 * *pourquoi*, là où un 400 ne rendrait qu'un `flatten()`.
 *
 * Écrit sans dépendance (ni Zod, ni React) pour rester testable dans
 * l'environnement `node` du dépôt.
 *
 * La règle qui compte : **seuils strictement croissants**. Deux paliers au
 * même seuil se paieraient ensemble, et « le palier suivant » n'aurait plus de
 * réponse déterminée pour la barre de progression du détail.
 */

/** Une ligne du formulaire, telle que la saisie la produit : deux chaînes. */
export interface TierDraft {
  stars: string;
  cp: string;
}

/** Un palier validé, dans la forme attendue par `PATCH /api/admin/sandbox-settings`. */
export interface TierValue {
  stars: number;
  cp: number;
}

export type TierValidation =
  | { ok: true; tiers: TierValue[] }
  | { ok: false; error: string };

/** Le plafond du schéma : au-delà, l'API refuse la liste entière. */
export const MAX_TIERS = 20;

/** Le plafond du bonus de promotion, même origine. */
export const MAX_PROMOTION_BONUS_CP = 100000;

/** Un entier écrit en toutes lettres, ou `null` — `Number("")` vaut 0, pas ici. */
function parseInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isInteger(value) ? value : null;
}

/**
 * Les lignes du formulaire → la liste à envoyer, ou le premier problème
 * rencontré, formulé pour être affiché tel quel.
 *
 * Une liste vide est **valide** : c'est le défaut inerte de la fonctionnalité,
 * qui ne paie rien tant que l'admin n'a rien configuré. Vider les paliers est
 * donc un geste légitime, pas une erreur de saisie.
 */
export function validateTiers(rows: TierDraft[]): TierValidation {
  if (rows.length > MAX_TIERS) {
    return { ok: false, error: `At most ${MAX_TIERS} milestones.` };
  }

  const tiers: TierValue[] = [];

  for (const [index, row] of rows.entries()) {
    const position = index + 1;
    const stars = parseInteger(row.stars);
    const cp = parseInteger(row.cp);

    if (stars === null || stars <= 0) {
      return { ok: false, error: `Milestone ${position}: the star threshold must be a whole number above 0.` };
    }
    if (cp === null || cp < 0) {
      return { ok: false, error: `Milestone ${position}: the CP reward must be a whole number, 0 or more.` };
    }

    const previous = tiers[tiers.length - 1];
    if (previous && stars <= previous.stars) {
      return {
        ok: false,
        error: `Milestone ${position}: thresholds must strictly increase — ${stars} comes after ${previous.stars}.`,
      };
    }

    tiers.push({ stars, cp });
  }

  return { ok: true, tiers };
}

/** Le bonus de promotion : un entier positif ou nul, plafonné comme en base. */
export function validatePromotionBonus(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const value = parseInteger(raw);
  if (value === null || value < 0) {
    return { ok: false, error: "The promotion bonus must be a whole number, 0 or more." };
  }
  if (value > MAX_PROMOTION_BONUS_CP) {
    return { ok: false, error: `The promotion bonus cannot exceed ${MAX_PROMOTION_BONUS_CP} CP.` };
  }
  return { ok: true, value };
}
