import type { ChallengeTeam } from "../../database-service/domain/entities.js";

/**
 * Règles de groupe — partie pure
 * ------------------------------
 * Constantes et calculs sans aucune dépendance à la base, pour que l'UI
 * puisse les importer : `group.ts` instancie un repository, donc un client
 * Postgres, qui n'a rien à faire dans un bundle navigateur.
 *
 * Voir docs/input/spec-groupes-challenge.md §3.
 */

/** Au-delà, le lien d'invitation cesse d'être joignable. */
export const GROUP_MAX_SIZE = 3;

/** Bonus de reward par membre supplémentaire — `1 + 0.4 × (n − 1)`. */
export const GROUP_MULTIPLIER_STEP = 0.4;

/**
 * Bonus collectif appliqué à l'award avant sa division en parts égales.
 *
 * Sous-linéaire : à 2 le groupe touche 140 % (70 % chacun), à 3 180 % (60 %
 * chacun). Un groupe reste donc moins coûteux pour le pool du challenge que
 * le même nombre de contributeurs en solo, qui draineraient 200 % et 300 %.
 *
 * Plafonné à GROUP_MAX_SIZE pour que le multiplicateur reste borné même si
 * une row échappait au contrôle de taille du join.
 */
export function groupMultiplier(size: number): number {
  const effective = Math.min(Math.max(1, Math.floor(size)), GROUP_MAX_SIZE);
  return 1 + GROUP_MULTIPLIER_STEP * (effective - 1);
}

/**
 * Le porteur du groupe : celui dont la row `challenge_teams` porte le
 * workspace.
 *
 * Il n'y a pas de colonne "créateur" : elle serait redondante avec le fait
 * qu'un seul membre a déclenché la copie du board et le provisioning de la
 * branche. On lit donc la trace de cette action — `workspace_ref` d'abord
 * (mode provided_repo), `workspace_url` ensuite (mode own_repo).
 *
 * Le repli sur le `user_id` le plus petit couvre la fenêtre pendant laquelle
 * le provisioning est encore en cours ou a échoué : il n'est pas "juste", il
 * est *déterministe*, ce qui suffit à garder les lectures cohérentes entre
 * deux appels.
 */
export function pickGroupOwner(members: ChallengeTeam[]): string {
  const withRef = members.filter((m) => m.workspace_ref);
  const withUrl = members.filter((m) => m.workspace_url);
  const candidates = withRef.length > 0 ? withRef : withUrl.length > 0 ? withUrl : members;
  return [...candidates].sort((a, b) => a.user_id.localeCompare(b.user_id))[0].user_id;
}

export interface GroupContext {
  /** Le `user_id` qui porte le workspace : l'appelant si solo, le créateur sinon. */
  ownerId: string;
  /** `null` pour une participation solo — c'est le test à faire, pas la taille de `memberIds`. */
  groupId: string | null;
  /** Tous les membres du groupe, porteur inclus. `[userId]` si solo. */
  memberIds: string[];
  /** Bonus de reward correspondant : 1 pour un solo. */
  multiplier: number;
}

/** Contexte d'un participant qu'on sait déjà solo, ou introuvable. */
function soloContext(userId: string): GroupContext {
  return { ownerId: userId, groupId: null, memberIds: [userId], multiplier: 1 };
}

/**
 * Même résolution, sur une liste de participants déjà en main.
 *
 * L'overview charge déjà `challenge_teams` en entier : lui faire relire la
 * table pour désigner le porteur serait une requête pour rien.
 */
export function groupContextFrom(participants: ChallengeTeam[], userId: string): GroupContext {
  const mine = participants.find((p) => p.user_id === userId);
  if (!mine?.group_id) return soloContext(userId);

  const members = participants.filter((p) => p.group_id === mine.group_id);
  // Un group_id qui ne rassemble qu'une row est un groupe dont personne n'a
  // encore rejoint : c'est un solo jusqu'à preuve du contraire, et surtout un
  // multiplicateur de 1. Le groupId reste posé pour que le lien d'invitation
  // fonctionne toujours.
  return {
    ownerId: pickGroupOwner(members),
    groupId: mine.group_id,
    memberIds: members.map((m) => m.user_id),
    multiplier: groupMultiplier(members.length),
  };
}
