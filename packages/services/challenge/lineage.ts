import type { MlLineage } from "../../evaluator/ml-reward.js";

/** Le strict nécessaire pour décider d'une réutilisation. */
export interface LineageContribution {
  uuid: string;
  user_id: string;
  type: string;
  artifact_url?: string;
  submitted_at: Date;
}

/**
 * Détermine quels artefacts un contributeur réutilise, et de qui.
 *
 * Règle : sur un même challenge, un artefact appartient à qui l'a soumis en
 * premier. Coller la même URL après lui est une réutilisation.
 *
 * La détection est volontairement limitée au challenge courant : réutiliser un
 * dataset d'un challenge passé ne déclenche rien.
 */
export function resolveLineage(
  contributions: LineageContribution[],
  userId: string
): MlLineage {
  const lineage: MlLineage = {};

  const slots = [
    { type: 'dataset', authorKey: 'datasetAuthorId', contribKey: 'datasetContributionId' },
    { type: 'model', authorKey: 'modelAuthorId', contribKey: 'modelContributionId' },
  ] as const;

  for (const { type, authorKey, contribKey } of slots) {
    const mine = contributions.find(c => c.user_id === userId && c.type === type);
    if (!mine?.artifact_url) continue;

    const author = contributions
      .filter(c => c.type === type && c.artifact_url === mine.artifact_url)
      .sort(byFirstSubmitted)[0];

    // Être le premier sur son propre artefact n'est pas une réutilisation.
    if (author && author.user_id !== userId) {
      lineage[authorKey] = author.user_id;
      lineage[contribKey] = author.uuid;
    }
  }

  return lineage;
}

/**
 * Départage par date de soumission, puis par uuid.
 *
 * Le second critère n'est pas cosmétique : deux soumissions peuvent porter le
 * même timestamp, et sans ordre total le "premier auteur" dépendrait de l'ordre
 * de la base — donc les points changeraient de main d'un appel à l'autre.
 */
function byFirstSubmitted(a: LineageContribution, b: LineageContribution): number {
  const diff = a.submitted_at.getTime() - b.submitted_at.getTime();
  return diff !== 0 ? diff : a.uuid.localeCompare(b.uuid);
}
