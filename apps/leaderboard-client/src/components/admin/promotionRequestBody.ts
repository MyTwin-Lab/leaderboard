/**
 * Le corps du `POST /api/sandboxes/:id/promote`, construit depuis l'état du
 * tiroir.
 *
 * Isolé dans son propre module (ni React, ni import `@/...`) pour être testé
 * directement, comme `templateTasksFlush.ts` et `briefFlush.ts`.
 *
 * `type` y figure depuis qu'un sandbox est un projet : `code` / `ml` était le
 * vocabulaire des challenges, une proposition n'en porte plus, et c'est donc
 * l'admin qui tranche ici, parmi les formes qu'une proposition peut prendre.
 *
 * `brief` y figure parce que la promotion l'écrit dans sa transaction, avec le
 * projet et le challenge : pas de second appel après coup comme à la création.
 *
 * Ce qui n'y figure **pas** reste le cœur de la règle : pas de `project_id`,
 * la promotion crée son propre projet ; `workspace_mode` et `github_repo`
 * découlent du type (un challenge `code` promu est un `own_repo` sur le dépôt
 * de son auteur) ; et les champs des challenges de validation n'ont pas de
 * sens ici — un challenge de validation dérive d'un challenge ML existant, pas
 * d'une proposition. La route les refuserait de toute façon : les envoyer
 * laisserait croire le contraire.
 */
export interface PromotionFormState {
  title: string;
  /** Le slug du challenge — pré-rempli avec celui de la proposition, modifiable. */
  slug: string;
  status: string;
  /** Choisi par l'admin dans le tiroir. */
  type: "code" | "ml";
  startDate: string;
  endDate: string;
  description: string;
  roadmap: string;
  /** Pré-rempli depuis les trois sections de la proposition, relu par l'admin. Vide = pas de brief. */
  brief: string;
  cp: number;
}

/** Ce que la route de promotion fixe elle-même, et qu'une section ne peut pas lui imposer. */
const INHERITED_FIELDS = ['type', 'workspace_mode', 'github_repo', 'project_id'];

export function buildPromotionRequestBody(
  state: PromotionFormState,
  flowFields: Record<string, unknown> = {},
): Record<string, unknown> {
  const fields = Object.fromEntries(Object.entries(flowFields).filter(([key]) => !INHERITED_FIELDS.includes(key)));
  return {
    title: state.title.trim(),
    slug: state.slug,
    status: state.status,
    type: state.type,
    // '' d'un input date vide signifie « pas de date », comme à la création.
    start_date: state.startDate || null,
    end_date: state.endDate || null,
    description: state.description.trim() || undefined,
    roadmap: state.roadmap.trim() || undefined,
    // Toujours envoyé, même vide : vide veut dire « effacé », pas « à composer ».
    brief: state.brief.trim(),
    contribution_points_reward: state.cp,
    ...fields,
  };
}
