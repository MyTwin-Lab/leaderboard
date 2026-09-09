import type { SandboxStar } from "../../database-service/domain/entities.js";

/** Le plan est exprimé en `uuid` de lignes : c'est tout ce dont la transaction a besoin. */
export interface AnonAttachPlan {
  /** Lignes anonymes à supprimer réellement — elles n'ont jamais eu à exister sous ce compte. */
  toDelete: string[];
  /** Lignes anonymes à migrer vers `user_id`, avec `attached_at`. */
  toAttach: string[];
}

/**
 * Décide ce que devient chaque star anonyme quand son navigateur se connecte —
 * pur, sans I/O. Branchée dans `SandboxStarRepository.attachAnonToUser`, qui
 * exécute les `DELETE` **avant** les `UPDATE`.
 *
 * Deux cas de suppression, un seul de migration :
 *
 * - le compte a déjà une ligne sur ce sandbox → la ligne anonyme est
 *   superflue. Cette ligne de compte compte **même soft-removed** : l'index
 *   unique `(sandbox_id, user_id)` ne connaît pas `removed_at`, migrer par
 *   dessus le violerait ;
 * - le sandbox appartient au compte → on ne star pas le sien (c'est la même
 *   règle que le 403 de `star()`, appliquée après coup).
 *
 * Tout le reste est migré, **y compris les lignes soft-removed** : la trace
 * d'audit suit la personne, et une re-star ultérieure réactivera cette ligne
 * au lieu d'en créer une seconde.
 *
 * Conséquence à connaître : le rattachement ne crée aucune ligne, donc un
 * compteur ne monte jamais à cette occasion et baisse de 1 par conflit résolu.
 * Repasser sous un seuil déjà payé est un état normal — un palier n'est jamais
 * repris.
 */
export function planAnonAttach(
  anonRows: SandboxStar[],
  accountRows: SandboxStar[],
  ownedSandboxIds: string[]
): AnonAttachPlan {
  // `removed_at` volontairement ignoré : l'index unique ne le regarde pas.
  const alreadyStarred = new Set(accountRows.map((row) => row.sandbox_id));
  const owned = new Set(ownedSandboxIds);
  // Ceinture : l'index unique partiel `(sandbox_id, anon_id) WHERE user_id IS
  // NULL` interdit déjà deux lignes anonymes sur le même sandbox, mais si l'une
  // arrivait quand même, en migrer deux violerait `(sandbox_id, user_id)`.
  const claimed = new Set<string>();

  const toDelete: string[] = [];
  const toAttach: string[] = [];

  for (const row of anonRows) {
    if (alreadyStarred.has(row.sandbox_id) || owned.has(row.sandbox_id) || claimed.has(row.sandbox_id)) {
      toDelete.push(row.uuid);
      continue;
    }
    claimed.add(row.sandbox_id);
    toAttach.push(row.uuid);
  }

  return { toDelete, toAttach };
}
