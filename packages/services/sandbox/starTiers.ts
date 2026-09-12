import type { SandboxStarTier } from "../../database-service/domain/entities.js";

/**
 * Économie des paliers de stars — pur, sans I/O.
 * ---------------------------------------------
 * Trois questions, trois fonctions : ce qu'il reste à payer, quel est le
 * palier suivant, et où en est la progression vers lui.
 *
 * Le point à ne pas perdre de vue : **l'état « palier payé » ne se déduit pas
 * du compteur**. Le rattachement d'une identité anonyme à un compte peut faire
 * baisser le nombre de stars actives sous un seuil déjà payé (voir §1.5 du
 * plan), et un palier n'est jamais repris. La liste des seuils réellement
 * payés vient donc toujours de `sandbox_rewards`, et c'est elle qu'on passe en
 * `paidThresholds` — jamais une déduction faite depuis `activeCount`.
 */

/**
 * Copie triée par seuil croissant.
 *
 * Les paliers sont censés arriver déjà ordonnés (le schéma Zod exige une
 * croissance stricte), mais tout le reste du fichier raisonne sur l'ordre :
 * on le garantit ici plutôt que de faire confiance à l'appelant.
 */
export function sortTiers(tiers: SandboxStarTier[]): SandboxStarTier[] {
  return [...tiers].sort((a, b) => a.stars - b.stars);
}

/**
 * Les paliers atteints par `activeCount` qui n'ont pas encore été payés.
 *
 * Renvoie une liste, et pas seulement le dernier palier franchi : une vague de
 * stars peut en franchir plusieurs entre deux passages (15 stars d'un coup sur
 * des paliers 5/15/30 doivent payer 5 *et* 15), et un palier ajouté après coup
 * par l'admin est ramassé au passage suivant sans rattrapage rétroactif.
 */
export function tiersToPay(
  activeCount: number,
  tiers: SandboxStarTier[],
  paidThresholds: number[]
): SandboxStarTier[] {
  const paid = new Set(paidThresholds);
  return sortTiers(tiers).filter((tier) => activeCount >= tier.stars && !paid.has(tier.stars));
}

/** Le premier palier strictement au-dessus du compteur, ou `null` s'ils sont tous atteints. */
export function nextTier(count: number, tiers: SandboxStarTier[]): SandboxStarTier | null {
  return sortTiers(tiers).find((tier) => count < tier.stars) ?? null;
}

/**
 * Progression vers le palier suivant, telle que la maquette la rend
 * (`tierPct` / `tierHint`) : une barre et une phrase.
 *
 * `pct` est mesuré **entre le palier précédent et le suivant**, pas depuis
 * zéro : sinon la barre repartirait presque pleine juste après un
 * franchissement. Sans palier suivant elle est à 100.
 */
export function tierProgress(
  count: number,
  tiers: SandboxStarTier[]
): { pct: number; hint: string } {
  const ordered = sortTiers(tiers);

  // Aucun palier configuré : l'économie des stars ne paie rien, il n'y a ni
  // progression ni jalon à annoncer. Défaut inerte, comme les réglages.
  if (ordered.length === 0) return { pct: 0, hint: "No milestones configured" };

  const next = ordered.find((tier) => count < tier.stars) ?? null;

  if (!next) {
    const total = ordered.reduce((sum, tier) => sum + tier.cp, 0);
    return { pct: 100, hint: `All milestones reached · ${total} CP paid` };
  }

  // Borne basse = dernier palier atteint, 0 tant qu'aucun ne l'est.
  const reached = ordered.filter((tier) => count >= tier.stars);
  const base = reached.length > 0 ? reached[reached.length - 1].stars : 0;
  const span = next.stars - base;
  const pct = span > 0 ? Math.round(((count - base) / span) * 100) : 0;

  const remaining = next.stars - count;
  const noun = remaining === 1 ? "star" : "stars";
  return {
    pct: Math.min(100, Math.max(0, pct)),
    hint: `${remaining} more ${noun} to +${next.cp} CP`,
  };
}
