/**
 * Répartition d'un montant de CP entre les membres d'un groupe.
 *
 * Fonction pure, sans dépendance à la base : c'est l'unique endroit qui décide
 * qui touche quoi quand un award de groupe est divisé.
 */

/**
 * Divise `total` en parts égales entre `memberIds`, à l'entier près.
 *
 * Les CP sont des entiers et une division tombe rarement juste : 1300 pour
 * trois donne 433,33. La méthode des plus grands restes distribue les unités
 * qui dépassent une par une, ce qui garantit l'invariant qui compte —
 * **Σ des parts = total, exactement**. Sans lui, le leaderboard cesserait de
 * sommer au total réellement distribué sur le challenge.
 *
 * Toutes les parts étant égales, les restes le sont aussi : l'ordre
 * d'attribution des unités surnuméraires est donc une convention. On sert le
 * porteur du groupe en premier, puis les autres par `user_id` croissant. Le
 * résultat ne dépend pas de l'ordre de `memberIds`, ce qui rend deux calculs
 * successifs identiques même si la base renvoie ses rows dans un autre ordre.
 *
 * `total` peut être négatif — une correction de ledger produit un delta
 * négatif à répartir, et `Math.floor` garde l'invariant de somme dans ce sens
 * aussi.
 */
export function splitShares(
  total: number,
  memberIds: string[],
  ownerId: string
): Map<string, number> {
  const shares = new Map<string, number>();
  const unique = [...new Set(memberIds)];
  if (unique.length === 0) return shares;

  // Le porteur d'abord, puis les autres triés. Un ownerId absent de la liste
  // (composition incohérente) ne doit pas créer une part fantôme : on retombe
  // alors sur le seul tri par identifiant.
  const others = unique.filter((id) => id !== ownerId).sort();
  const ordered = unique.includes(ownerId) ? [ownerId, ...others] : others;

  const n = ordered.length;
  const base = Math.floor(total / n);
  const remainder = total - base * n; // 0 <= remainder < n, y compris si total < 0

  ordered.forEach((id, i) => {
    shares.set(id, base + (i < remainder ? 1 : 0));
  });

  return shares;
}
