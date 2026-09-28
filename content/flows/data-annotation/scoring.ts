import { GOLD, type AnnotationConfig } from "./config.js";

/**
 * Logique pure du flow : accord, qualité, clearance et paie. Aucune
 * lecture ici ; les actions passent ce qu'elles ont lu.
 */

/** Ce que ces calculs lisent d'une réclamation consommée. */
export interface LabeledClaim {
  resource_type: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
}

export type Consensus = { verdict: "labeled"; consensus: string } | { verdict: "contested" };

/**
 * L'accord de `k` labels : la réponse strictement la plus fréquente. Toute
 * égalité en tête est contestée — avec k = 3, seulement trois réponses
 * différentes ; au-delà, aussi `A A B B C` pour k = 5, que « tous
 * différents » ne couvrait pas.
 */
export function resolveConsensus(values: readonly string[]): Consensus {
  const tally = new Map<string, number>();
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);

  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { verdict: "contested" };
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return { verdict: "contested" };
  return { verdict: "labeled", consensus: ranked[0][0] };
}

/** Le décompte des labels d'un item, pour les écrans du manager. */
export function tallyOf(values: readonly string[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const value of values) tally[value] = (tally[value] ?? 0) + 1;
  return tally;
}

/**
 * Le nombre de labels les plus récents d'un annotateur que sa qualité ignore.
 *
 * Une précision recalculée après chaque label ne bougerait qu'après un gold :
 * en comparant son score avant et après, l'annotateur saurait quelle image
 * était un gold et s'il y avait bien répondu. Décalée de dix labels, la
 * variation ne se rattache plus à une image.
 */
export const QUALITY_LAG = 10;

export interface AnnotatorQuality {
  goldSeen: number;
  goldCorrect: number;
  /** `null` tant qu'aucun gold ne compte. */
  accuracy: number | null;
}

export function valueOf(claim: Pick<LabeledClaim, "result">): string | null {
  return typeof claim.result.value === "string" ? claim.result.value : null;
}

function isCorrectGold(claim: LabeledClaim): boolean {
  return valueOf(claim) !== null && valueOf(claim) === claim.payload.expected;
}

/**
 * La qualité d'un annotateur : sommes vivantes sur ses golds consommés, sans
 * compteur stocké. `claims` est rangé du plus récent au plus ancien ; les
 * `lag` premiers sont ignorés.
 */
export function annotatorQuality(claims: readonly LabeledClaim[], lag = QUALITY_LAG): AnnotatorQuality {
  const golds = claims.slice(lag).filter((claim) => claim.resource_type === GOLD);
  const goldCorrect = golds.filter(isCorrectGold).length;
  return {
    goldSeen: golds.length,
    goldCorrect,
    accuracy: golds.length > 0 ? goldCorrect / golds.length : null,
  };
}

/** L'annotateur reçoit les items sensibles. */
export function clearsSensitive(quality: AnnotatorQuality, clearance: AnnotationConfig["sensitive_clearance"]): boolean {
  return quality.goldSeen >= clearance.min_seen && (quality.accuracy ?? 0) >= clearance.min_accuracy;
}

/**
 * Ce qu'un label rapporte : le forfait pondéré par la précision (entière tant
 * qu'aucun gold ne compte), arrondi, borné par le reliquat du pool.
 * Identique pour un gold et pour un item.
 */
export function labelPay(perUnitCp: number, quality: AnnotatorQuality, remainingPool: number): number {
  const weighted = Math.round(perUnitCp * (quality.accuracy ?? 1));
  return Math.max(0, Math.min(weighted, remainingPool));
}
