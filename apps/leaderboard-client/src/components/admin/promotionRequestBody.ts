/**
 * Le corps du `POST /api/sandboxes/:id/promote`, construit depuis l'état du
 * tiroir.
 *
 * Isolé dans son propre module (ni React, ni import `@/...`) pour être testé
 * directement, comme `templateTasksFlush.ts` et `briefFlush.ts`.
 *
 * Les champs communs sont ceux que l'admin saisit pour tout challenge. Ceux du
 * flow (règles, puissance de calcul, étape d'API…) viennent de sa section de
 * formulaire, en mode promotion. Ce qui n'y figure **pas** est le cœur de la
 * règle : `type` est hérité de la proposition, et `workspace_mode` comme
 * `github_repo` en découlent — la route les refuserait de toute façon.
 */
export interface PromotionFormState {
  title: string;
  /** Le slug du challenge — pré-rempli avec celui de la proposition, modifiable. */
  slug: string;
  status: string;
  startDate: string;
  endDate: string;
  description: string;
  roadmap: string;
  cp: number;
  projectId: string;
}

/** Ce que la route de promotion fixe elle-même, et qu'une section ne peut pas lui imposer. */
const INHERITED_FIELDS = ['type', 'workspace_mode', 'github_repo'];

export function buildPromotionRequestBody(
  state: PromotionFormState,
  flowFields: Record<string, unknown> = {},
): Record<string, unknown> {
  const fields = Object.fromEntries(Object.entries(flowFields).filter(([key]) => !INHERITED_FIELDS.includes(key)));
  return {
    title: state.title.trim(),
    slug: state.slug,
    status: state.status,
    // '' d'un input date vide signifie « pas de date », comme à la création.
    start_date: state.startDate || null,
    end_date: state.endDate || null,
    description: state.description.trim() || undefined,
    roadmap: state.roadmap.trim() || undefined,
    contribution_points_reward: state.cp,
    project_id: state.projectId,
    ...fields,
  };
}
