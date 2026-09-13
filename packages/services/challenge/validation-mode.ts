/**
 * De quel côté du challenge de validation on se trouve.
 *
 * Le mode n'est PAS stocké. Il se déduit du type du challenge source à chaque
 * lecture : `source_challenge_id` qui pointe un challenge `ml` veut dire flux
 * cas de référence, un challenge `code` veut dire flux scénario. Une colonne
 * `validation_mode` serait une seconde source de vérité qui peut dériver de
 * la première — donc une source de bugs impossibles à diagnostiquer.
 */
export type ValidationMode = 'reference_case' | 'scenario';

/**
 * Le type de contribution exposable comme cible, par mode. En ML c'est le
 * packaging d'API du contributeur ; en scénario c'est son livrable `project`,
 * que l'équipe a déployé à la main.
 */
export const TARGET_CONTRIBUTION_TYPE: Record<ValidationMode, string> = {
  reference_case: 'api_packaging',
  scenario: 'project',
};

/**
 * Renvoie null — plutôt qu'un mode par défaut — quand le challenge source
 * n'existe pas ou n'est ni `ml` ni `code`. Un défaut ferait tomber un
 * challenge mal câblé dans le flux ML, où il proposerait un parcours de cas
 * de référence qui n'a jamais été écrit. L'appelant doit décider quoi
 * répondre (400 dans toutes les routes de ce plan).
 */
export function validationModeFor(sourceChallengeType: string | null | undefined): ValidationMode | null {
  if (sourceChallengeType === 'code') return 'scenario';
  if (sourceChallengeType === 'ml') return 'reference_case';
  return null;
}
