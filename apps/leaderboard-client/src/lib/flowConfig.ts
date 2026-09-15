/**
 * La configuration d'un challenge (`flow_config`) telle que les écrans la lisent.
 *
 * Vue provisoire : les écrans du shell branchent encore sur le type de
 * challenge et lisent ces clés à plat. Les slots d'interface des flows les
 * remplacent au lot L4 du challenge 020 ; d'ici là, c'est le seul endroit
 * côté client qui connaisse la forme de `flow_config`.
 *
 * Pur et sans registre : utilisable dans un composant client.
 */
export interface ChallengeFlowConfigView {
  /** Flow code : d'où vient le livrable évalué. */
  workspace_mode: 'provided_repo' | 'own_repo';
  /** Flow validation : CP par validation, 0 si absent. */
  cp_per_validation: number;
  /** Flow validation : quorum de verdicts, `null` en mode scénario. */
  required_validations: number | null;
  /** Extension compute : demandes de puissance de calcul ouvertes. */
  compute_enabled: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function flowConfigView(challenge: { flow_config?: unknown } | null | undefined): ChallengeFlowConfigView {
  const config = asRecord(challenge?.flow_config);
  const compute = asRecord(asRecord(config.extensions).compute);
  return {
    workspace_mode: config.workspace_mode === 'own_repo' ? 'own_repo' : 'provided_repo',
    cp_per_validation: typeof config.cp_per_validation === 'number' ? config.cp_per_validation : 0,
    required_validations: typeof config.required_validations === 'number' ? config.required_validations : null,
    compute_enabled: compute.enabled === true,
  };
}
