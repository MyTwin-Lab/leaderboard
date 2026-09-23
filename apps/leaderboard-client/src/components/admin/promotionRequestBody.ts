/**
 * Le corps du `POST /api/sandboxes/:id/promote`, construit depuis l'état du
 * tiroir.
 *
 * Isolé dans son propre module (ni React, ni import `@/...`) pour être testé
 * directement, comme `templateTasksFlush.ts` et `briefFlush.ts`.
 *
 * `type` y figure depuis qu'un sandbox est un projet : `code` / `ml` était le
 * vocabulaire des challenges, une proposition n'en porte plus, et c'est donc
 * l'admin qui tranche ici. Le serveur ne le lit que dans ce cas — une
 * proposition d'avant impose le sien, quoi qu'envoie le tiroir.
 *
 * Ce qui n'y figure **pas** reste le cœur de la règle : `workspace_mode` et
 * `github_repo` découlent du type (un challenge `code` promu est un `own_repo`
 * sur le dépôt de son auteur), et les champs des challenges de validation n'ont
 * pas de sens ici — un challenge de validation dérive d'un challenge ML
 * existant, pas d'une proposition. La route les refuserait de toute façon :
 * les envoyer laisserait croire le contraire.
 */
export interface PromotionFormState {
  title: string;
  /** Le slug du challenge — pré-rempli avec celui de la proposition, modifiable. */
  slug: string;
  status: string;
  /** Choisi par l'admin, sauf sur une proposition d'avant qui impose le sien. */
  type: "code" | "ml";
  startDate: string;
  endDate: string;
  description: string;
  roadmap: string;
  cp: number;
  projectId: string;
  rewardRules: unknown;
  codeRules: unknown;
  computeEnabled: boolean;
  apiPackagingEnabled: boolean;
}

export function buildPromotionRequestBody(state: PromotionFormState): Record<string, unknown> {
  const isMl = state.type === "ml";

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
    contribution_points_reward: state.cp,
    project_id: state.projectId,
    // Sans règles, le service n'a rien contre quoi scorer la reprise du travail
    // de l'auteur — c'est ce qui rendrait la promotion muette côté CP.
    reward_rules: isMl ? state.rewardRules : state.codeRules,
    compute_enabled: isMl ? state.computeEnabled : false,
    api_packaging_enabled: isMl ? state.apiPackagingEnabled : undefined,
  };
}
