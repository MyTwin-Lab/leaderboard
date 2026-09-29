import type { Sandbox } from "../../database-service/domain/entities.js";

/**
 * Promotion — la partie **pure**.
 * ------------------------------
 * Tout ce qui se décide sans base : le projet que devient la proposition, le
 * brouillon de son premier challenge, le brief de ce challenge et la
 * participation de l'auteur.
 *
 * Ce qui n'y est plus : les seeds `workspace_meta` des repos ML et les
 * contributions qui reprenaient le travail déjà déposé. Elles recopiaient le
 * dépôt, le dataset et le modèle de la proposition — trois champs qu'un
 * sandbox ne porte plus, parce qu'une proposition est une idée et pas un début
 * de livrable. L'auteur soumet depuis le challenge, comme tout le monde.
 *
 * `sandbox-promotion.service.ts` se charge de l'écrire ; ici rien n'est
 * persisté, ce qui rend chaque règle testable sans transaction.
 */

/** Ce que l'admin remplit dans le tiroir, une fois les champs figés retirés. */
export interface PromotionInput {
  /** Vide = on garde le titre de la proposition. */
  title?: string | null;
  /**
   * Vide = le slug de la proposition, ou son premier dérivé libre côté
   * challenges. Résolu par `SandboxPromotionService`, qui seul lit la base :
   * il n'apparaît donc pas dans `PromotedChallengeDraft`.
   */
  slug?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  /** Vide = le contexte de la proposition, comme accroche du challenge. */
  description?: string | null;
  roadmap?: string | null;
  /**
   * Vide = le brief est composé depuis les trois sections de la proposition
   * (`buildPromotedBrief`). C'est le texte que le tiroir pré-remplit et que
   * l'admin relit ; s'il l'efface entièrement, le challenge naît sans brief.
   */
  brief?: string | null;
  contribution_points_reward: number;
  reward_rules?: unknown;
  compute_enabled?: boolean;
  api_packaging_enabled?: boolean;
  /**
   * La forme du challenge, **choisie par l'admin**. Une proposition n'en porte
   * pas : `code` / `ml` décide des repos à créer et de la grille, c'est une
   * décision de challenge. Absent = `code`.
   */
  type?: "code" | "ml" | null;
  /**
   * Présent pour être **ignoré** : un challenge `code` issu d'une promotion
   * est forcément en `own_repo`. Le typer ici rend le fait explicite plutôt
   * que de le laisser à un `Omit` silencieux.
   */
  workspace_mode?: unknown;
}

/**
 * La ligne `projects` à insérer : le projet que devient la proposition.
 *
 * Toujours un **nouveau** projet, jamais un rattachement à un projet
 * existant — un sandbox est un projet, la promotion ne fait que le rendre
 * officiel. Son auteur en devient le manager : c'est son idée, et le rôle de
 * manager (`projects.manager_id`, voir docs/auth.md) est exactement ce qui lui
 * donne la main sur les challenges qui y naîtront.
 */
export interface PromotedProjectDraft {
  title: string;
  description: string | null;
  manager_id: string;
}

/** La ligne `challenges` à insérer, dans le vocabulaire du domaine. Son `project_id` est celui du projet créé en même temps. */
export interface PromotedChallengeDraft {
  title: string;
  status: string;
  type: "code" | "ml";
  start_date: Date | null;
  end_date: Date | null;
  description: string | null;
  roadmap: string | null;
  contribution_points_reward: number;
  completion: number;
  reward_rules: unknown;
  /**
   * La configuration candidate du flow (`workspace_mode` d'un code, l'extension
   * compute d'un ml), validée par le flow à l'écriture (`prepareFlowConfig`).
   */
  flow_config: Record<string, unknown>;
  /** La couverture de la proposition, reprise telle quelle. */
  cover_image_url: string | null;
  source_challenge_id: null;
}

/** '' d'un input date vide vaut « pas de date », comme à la création. */
function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function trimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function trimmedGoals(goals: string[] | null | undefined): string[] {
  return (goals ?? []).map((goal) => goal.trim()).filter(Boolean);
}

/**
 * Le projet que devient la proposition : son titre, son contexte en
 * description, son auteur en manager.
 */
export function buildPromotedProject(
  sandbox: Pick<Sandbox, "title" | "context" | "user_id">,
): PromotedProjectDraft {
  return {
    title: sandbox.title,
    description: trimmed(sandbox.context) || null,
    manager_id: sandbox.user_id,
  };
}

/**
 * L'accroche du challenge : le contexte de la proposition, tel quel.
 *
 * `challenges.description` est le texte court des cartes et de l'en-tête ; les
 * trois sections de la proposition, elles, vont dans le brief
 * (`buildPromotedBrief`). Les recopier ici aussi doublerait le même texte sur
 * la même page.
 */
export function buildPromotedDescription(sandbox: Pick<Sandbox, "context">): string {
  return trimmed(sandbox.context);
}

/**
 * Le brief composé depuis les trois sections de la proposition, dans la forme
 * du squelette de brief (`BRIEF_TEMPLATE`, côté client) : `## Context` puis
 * `## Objective`.
 *
 * La vitrine du challenge lit la section `Context` comme « Why this challenge
 * exists » : le contexte et le why de la proposition y vont tous les deux —
 * le problème, puis pourquoi il compte. Les buts deviennent la liste
 * d'objectifs. La section « Expected result » du squelette n'a pas de source
 * dans une proposition : elle n'est pas écrite plutôt que laissée vide, et
 * l'admin l'ajoute dans le tiroir s'il la veut.
 *
 * Une section vide ne produit **aucun** titre — un « ## Objective » suivi de
 * rien donnerait un brief qui a l'air bâclé.
 */
export function buildPromotedBrief(
  sandbox: Pick<Sandbox, "context" | "goals" | "why">,
): string {
  const sections: string[] = [];

  const context = [trimmed(sandbox.context), trimmed(sandbox.why)].filter(Boolean);
  if (context.length > 0) sections.push(`## Context\n\n${context.join("\n\n")}`);

  const goals = trimmedGoals(sandbox.goals);
  if (goals.length > 0) {
    sections.push(`## Objective\n\n${goals.map((g) => `- ${g}`).join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * La configuration du flow que décide la promotion.
 *
 * `workspace_mode: 'own_repo'` est forcé pour un challenge `code` : l'auteur
 * déclarera son dépôt comme les autres participants, il n'y a pas de repo
 * partagé à provisionner ni de branche à lui créer. Un `ml` n'a pas de mode ;
 * seule l'extension compute s'y règle, et jamais sur un `code`.
 */
export function buildPromotedFlowConfig(type: "code" | "ml", input: Pick<PromotionInput, "compute_enabled">): Record<string, unknown> {
  if (type === "code") return { workspace_mode: "own_repo" };
  return { extensions: { compute: { enabled: input.compute_enabled ?? false } } };
}

/**
 * Le premier challenge du projet que devient la proposition.
 *
 * **Le type est choisi ici, par l'admin.** Une proposition n'en porte plus :
 * `code` / `ml` décide des repos à créer et de la grille d'évaluation, c'est
 * donc une décision de challenge, pas de proposition. `code` par défaut, la
 * forme la plus courante.
 */
export function buildPromotedChallengeDraft(
  sandbox: Pick<Sandbox, "title" | "context" | "cover_image_url">,
  input: PromotionInput,
): PromotedChallengeDraft {
  const type = input.type === "ml" ? "ml" : "code";
  const description = trimmed(input.description) || buildPromotedDescription(sandbox);

  return {
    title: trimmed(input.title) || sandbox.title,
    status: input.status,
    type,
    start_date: toDate(input.start_date),
    end_date: toDate(input.end_date),
    description: description || null,
    roadmap: trimmed(input.roadmap) || null,
    contribution_points_reward: input.contribution_points_reward,
    completion: 0,
    reward_rules: input.reward_rules ?? null,
    flow_config: buildPromotedFlowConfig(type, input),
    // La couverture suit la proposition : le challenge s'ouvre avec l'image
    // que la communauté a vue en la starant. L'admin peut la remplacer ensuite.
    cover_image_url: sandbox.cover_image_url ?? null,
    // Un challenge de validation dérive d'un challenge existant : il ne peut
    // pas naître d'une proposition.
    source_challenge_id: null,
  };
}

/**
 * Le brief que reçoit le challenge : celui que l'admin a relu dans le tiroir,
 * ou, si la promotion arrive sans (un script, un seed), celui composé depuis
 * la proposition. Une chaîne vide est un choix — l'admin a tout effacé — et
 * vaut « pas de document ».
 */
export function resolvePromotedBrief(
  sandbox: Pick<Sandbox, "context" | "goals" | "why">,
  input: Pick<PromotionInput, "brief">,
): string {
  return input.brief == null ? buildPromotedBrief(sandbox) : trimmed(input.brief);
}

/** La row `challenge_teams` de l'auteur. */
export interface AuthorParticipation {
  challenge_id: string;
  user_id: string;
  workspace_provider: null;
  workspace_url: null;
  workspace_status: "pending";
}

/**
 * L'auteur devient membre de son challenge, son workspace restant à déclarer.
 *
 * `workspace_status: 'pending'` et pas `'ready'` : une proposition ne porte
 * plus de dépôt — c'est une idée, pas un début de livrable — donc il n'y a
 * rien à pré-remplir. C'est exactement l'état d'un contributeur qui vient de
 * rejoindre un challenge `own_repo`, et l'écran de workspace lui demande son
 * dépôt comme à n'importe qui d'autre.
 *
 * Ce qui compte ici est la ligne elle-même : l'auteur est membre de son
 * challenge dès la promotion, sans avoir à le rejoindre.
 */
export function buildAuthorParticipation(
  sandbox: Pick<Sandbox, "user_id">,
  challengeId: string,
): AuthorParticipation {
  return {
    challenge_id: challengeId,
    user_id: sandbox.user_id,
    workspace_provider: null,
    workspace_url: null,
    workspace_status: "pending",
  };
}
