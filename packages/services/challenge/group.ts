import { ChallengeTeamRepository } from "../../database-service/repositories/index.js";
import type { ChallengeTeam } from "../../database-service/domain/entities.js";
import { groupContextFrom, pickGroupOwner, type GroupContext } from "./groupPolicy.js";

// Réexportés pour que les appelants serveur n'aient qu'un import à connaître.
export {
  GROUP_MAX_SIZE,
  GROUP_MULTIPLIER_STEP,
  groupMultiplier,
  groupContextFrom,
  pickGroupOwner,
  type GroupContext,
} from "./groupPolicy.js";

/**
 * Travail en groupe sur un challenge
 * ----------------------------------
 * Un groupe partage un workspace : un board, une branche, une évaluation, une
 * contribution. Plutôt que d'ajouter un second axe de propriété (`group_id`
 * sur `tasks`, `contributions`, …), qui doublerait chaque requête et chaque
 * contrôle de permission, tout passe par une indirection unique :
 *
 *     resolveWorkspaceOwner(challengeId, userId) -> userId du porteur
 *
 * Le reste du code continue d'ancrer la propriété sur un `user_id` ; il opère
 * simplement sur celui du porteur au lieu de celui de l'appelant. Un
 * participant solo est son propre porteur, donc son comportement est
 * strictement inchangé.
 *
 * Voir docs/input/spec-groupes-challenge.md §3.
 */

export interface GroupDeps {
  challengeTeamRepo: Pick<ChallengeTeamRepository, "findByChallenge">;
}

function defaultDeps(deps?: Partial<GroupDeps>): GroupDeps {
  return { challengeTeamRepo: new ChallengeTeamRepository(), ...deps };
}

/**
 * Tout ce dont un appelant a besoin sur le groupe d'un contributeur, en une
 * seule requête.
 *
 * `findByChallenge` plutôt que trois lectures ciblées : le scoring et les
 * routes de tâches sont sur le chemin chaud, et la table est petite (une row
 * par participant). On paie une lecture pour obtenir l'owner, la composition
 * et le multiplicateur d'un coup.
 *
 * Un contributeur qui ne participe pas encore reçoit un contexte solo : les
 * appelants qui exigent une participation la vérifient déjà de leur côté, et
 * renvoyer `null` ici les obligerait tous à gérer un cas de plus.
 */
export async function getGroupContext(
  challengeId: string,
  userId: string,
  deps?: Partial<GroupDeps>
): Promise<GroupContext> {
  const { challengeTeamRepo } = defaultDeps(deps);
  return groupContextFrom(await challengeTeamRepo.findByChallenge(challengeId), userId);
}

/** Raccourci pour les appelants qui n'ont besoin que de la clé de propriété. */
export async function resolveWorkspaceOwner(
  challengeId: string,
  userId: string,
  deps?: Partial<GroupDeps>
): Promise<string> {
  return (await getGroupContext(challengeId, userId, deps)).ownerId;
}
