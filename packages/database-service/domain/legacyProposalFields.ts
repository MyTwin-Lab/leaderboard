/**
 * Colonnes remplacées par `sandboxes.proposal_fields` (challenge 020, lot L3)
 * -----------------------------------------------------------------------
 * `repo_url`, `model_url` et `dataset_urls` sont repris dans le jsonb
 * `proposal_fields`, que le schéma du flow proposable validera quand la
 * sandbox deviendra un module (lot L6). D'ici au lot L7, les colonnes restent :
 *
 * - elles sont **écrites** en miroir de `proposal_fields`, pour qu'un retour
 *   arrière du code retrouve des colonnes à jour ;
 * - elles servent de **repli**, clé par clé, à la lecture d'une ligne dont le
 *   jsonb est vide ou incomplet, écrite par l'ancien code pendant un
 *   déploiement.
 *
 * Tout ce fichier disparaît avec les colonnes, en L7.
 */

export interface LegacySandboxColumns {
  repo_url: string;
  model_url?: string | null;
  dataset_urls?: string[] | null;
}

export interface SandboxProposal {
  proposal_fields: Record<string, unknown>;
  repo_url: string;
  model_url: string | null;
  dataset_urls: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Les champs de proposition tels que les colonnes les portent. Même
 * correspondance que la reprise de `scripts/db-apply-schema.ts` : les trois
 * clés pour tous les types, le schéma du flow fera le tri en L6.
 */
export function proposalFieldsFromLegacyColumns(columns: LegacySandboxColumns): Record<string, unknown> {
  return {
    repo_url: columns.repo_url,
    model_url: columns.model_url ?? null,
    dataset_urls: columns.dataset_urls ?? [],
  };
}

/** Les seules clés qu'une édition fournit : une clé absente n'est pas écrite, `null` est une valeur. */
export function proposalFieldsPatch(patch: Partial<LegacySandboxColumns>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (patch.repo_url !== undefined) fields.repo_url = patch.repo_url;
  if (patch.model_url !== undefined) fields.model_url = patch.model_url;
  if (patch.dataset_urls !== undefined) fields.dataset_urls = patch.dataset_urls;
  return fields;
}

/** La proposition d'une ligne : le jsonb d'abord, les colonnes pour chaque clé qu'il ne porte pas. */
export function sandboxProposalOf(row: LegacySandboxColumns & { proposal_fields?: unknown }): SandboxProposal {
  const stored = asRecord(row.proposal_fields);
  const datasets = stored.dataset_urls;
  return {
    proposal_fields: { ...proposalFieldsFromLegacyColumns(row), ...stored },
    repo_url: typeof stored.repo_url === "string" ? stored.repo_url : row.repo_url,
    model_url: "model_url" in stored
      ? (typeof stored.model_url === "string" ? stored.model_url : null)
      : (row.model_url ?? null),
    dataset_urls: Array.isArray(datasets)
      ? datasets.filter((url): url is string => typeof url === "string")
      : (row.dataset_urls ?? []),
  };
}
