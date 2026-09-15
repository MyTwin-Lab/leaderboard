/**
 * Colonnes remplacées par `challenges.flow_config` (challenge 020, lot L3)
 * ---------------------------------------------------------------------
 * `workspace_mode`, `compute_enabled`, `cp_per_validation` et
 * `required_validations` ne sont plus lues par le code, mais elles restent en
 * base jusqu'au lot L7 :
 *
 * - elles sont **écrites** en miroir de `flow_config`, pour qu'un retour
 *   arrière du code retrouve des colonnes à jour ;
 * - elles servent de **repli** à la lecture d'une ligne sans `flow_config`,
 *   écrite par l'ancien code encore en ligne pendant un déploiement.
 *
 * Tout ce fichier disparaît avec les colonnes, en L7. C'est la seule place du
 * core qui connaisse ces clés de configuration.
 */

export interface LegacyChallengeColumns {
  workspace_mode: string | null;
  compute_enabled: boolean;
  cp_per_validation: number | null;
  required_validations: number | null;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

/** Les colonnes historiques en miroir d'une configuration. */
export function legacyChallengeColumns(flowConfig: unknown): LegacyChallengeColumns {
  const config = asRecord(flowConfig);
  return {
    workspace_mode: typeof config.workspace_mode === "string" ? config.workspace_mode : null,
    compute_enabled: asRecord(asRecord(config.extensions).compute).enabled === true,
    cp_per_validation: typeof config.cp_per_validation === "number" ? config.cp_per_validation : null,
    required_validations: typeof config.required_validations === "number" ? config.required_validations : null,
  };
}

/**
 * La configuration d'une ligne écrite sans `flow_config`, reconstituée depuis
 * les colonnes historiques. Même correspondance que la reprise de
 * `scripts/db-apply-schema.ts`.
 */
export function flowConfigFromLegacyColumns(
  type: string | null | undefined,
  columns: Partial<LegacyChallengeColumns>,
): Record<string, unknown> {
  switch (type ?? "code") {
    case "code":
      return { workspace_mode: columns.workspace_mode ?? "provided_repo" };
    case "ml":
      return { extensions: { compute: { enabled: columns.compute_enabled === true } } };
    // `validation` : une ligne écrite par l'ancien code, avant la scission en
    // deux flows (challenge 020, L3).
    case "validation":
    case "endpoint-validation":
    case "journey-validation":
      return {
        ...(columns.cp_per_validation != null ? { cp_per_validation: columns.cp_per_validation } : {}),
        required_validations: columns.required_validations ?? null,
      };
    default:
      return {};
  }
}
