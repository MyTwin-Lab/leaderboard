import { isBriefGated } from './challengeBrief';
import { GROUP_MAX_SIZE } from '../../../../packages/database-service/domain/groupPolicy';

/**
 * Règles du parcours « rejoindre » — pures, sans React.
 *
 * Elles vivent à côté de `challengeBrief.ts`, qui porte la porte jumelle : les
 * deux décident de ce qu'un non-membre voit, et les séparer davantage les
 * ferait diverger.
 *
 * `groupPolicy` est la moitié pure du module de groupes, la seule qu'un
 * composant client puisse importer : `capabilities/groups.ts` instancie un repository, donc
 * un client Postgres, qui n'a rien à faire dans un bundle navigateur.
 */

/** Combien de personnes on peut inviter : la taille du groupe moins sa place. */
export const MAX_INVITEES = GROUP_MAX_SIZE - 1;

/** Un challenge fermé refuse le join côté serveur — on n'offre pas le bouton. */
function isOpen(status: string | null | undefined): boolean {
  return status !== 'completed' && status !== 'archived';
}

/**
 * Le bouton `Join` remplace-t-il `Docs` dans l'en-tête ?
 *
 * C'est `shouldShowBrief` moins la présence d'un brief : un challenge qui n'en
 * a pas a quand même besoin d'un chemin pour être rejoint. Les deux portes
 * s'ouvrent aux anonymes — la page challenge est publique, donc un visiteur
 * qui peut tout lire mérite qu'on lui dise comment participer.
 *
 * C'est le composant qui envoie un anonyme vers `/signin` plutôt que d'ouvrir
 * la modale — et c'est ainsi qu'aucun chemin ne permet plus à un non-connecté
 * de déclencher une requête de join.
 */
export function showJoinInHeader({
  isMember, challengeType, challengeStatus,
}: {
  isMember: boolean;
  challengeType: string | null | undefined;
  challengeStatus: string | null | undefined;
}): boolean {
  if (isMember) return false;
  if (!isOpen(challengeStatus)) return false;
  return isBriefGated(challengeType);
}

/**
 * Ce que fait le bouton unique, en fonction de la liste préparée.
 *
 * Un groupe d'une personne se comporte exactement comme un solo (multiplicateur
 * 1, workspace à soi) mais garde la porte ouverte, ce qu'une participation solo
 * ne fait jamais. La bascule à `group` dès la première sélection n'est donc
 * jamais un mauvais choix pour l'utilisateur.
 */
export function joinAction(selectedCount: number): { mode: 'solo' | 'group'; label: string } {
  return selectedCount === 0
    ? { mode: 'solo', label: 'Join' }
    : { mode: 'group', label: 'Join as a group' };
}

/** Reste-t-il de la place dans la sélection ? */
export function canSelectMore(selectedCount: number): boolean {
  return selectedCount < MAX_INVITEES;
}
