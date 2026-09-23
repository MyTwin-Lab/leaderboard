import type { Sandbox } from "../../database-service/domain/entities.js";

/**
 * Promotion — la partie **pure**.
 * ------------------------------
 * Tout ce qui se décide sans base : le brouillon du challenge et la
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
  /** Vide = la description markdown est composée depuis la proposition. */
  description?: string | null;
  roadmap?: string | null;
  contribution_points_reward: number;
  project_id: string;
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

/** La ligne `challenges` à insérer, dans le vocabulaire du domaine. */
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
  project_id: string;
  reward_rules: unknown;
  compute_enabled: boolean;
  /** La couverture de la proposition, reprise telle quelle. */
  cover_image_url: string | null;
  workspace_mode: "own_repo" | null;
  source_challenge_id: null;
  cp_per_validation: null;
  required_validations: null;
}

/** '' d'un input date vide vaut « pas de date », comme à la création. */
function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function trimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * La description markdown composée depuis les trois sections de la proposition.
 *
 * `challenges.description` est un markdown unique, `sandboxes` porte trois
 * champs distincts (§1.1) : c'est ici que la conversion se fait. Une section
 * vide ne produit **aucun** titre — un « ## Why it matters » suivi de rien
 * donnerait un challenge qui a l'air bâclé.
 */
export function buildPromotedDescription(
  sandbox: Pick<Sandbox, "context" | "goals" | "why">,
): string {
  const sections: string[] = [];

  const context = trimmed(sandbox.context);
  if (context) sections.push(`## Context\n\n${context}`);

  const goals = (sandbox.goals ?? []).map((goal) => goal.trim()).filter(Boolean);
  if (goals.length > 0) {
    sections.push(`## What I want to build\n\n${goals.map((g) => `- ${g}`).join("\n")}`);
  }

  const why = trimmed(sandbox.why);
  if (why) sections.push(`## Why it matters\n\n${why}`);

  return sections.join("\n\n");
}

/**
 * Le challenge que devient la proposition.
 *
 * **Le type est choisi ici, par l'admin.** Une proposition n'en porte plus :
 * `code` / `ml` décide des repos à créer et de la grille d'évaluation, c'est
 * donc une décision de challenge, pas de proposition. `code` par défaut, la
 * forme la plus courante.
 *
 * `workspace_mode: 'own_repo'` est forcé pour un challenge `code` : l'auteur
 * déclarera son dépôt comme les autres participants, il n'y a pas de repo
 * partagé à provisionner ni de branche à lui créer. La colonne reste NULL pour
 * un `ml`, qui n'a pas de mode.
 */
export function buildPromotedChallengeDraft(
  sandbox: Pick<Sandbox, "title" | "context" | "goals" | "why" | "cover_image_url">,
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
    project_id: input.project_id,
    reward_rules: input.reward_rules ?? null,
    compute_enabled: type === "ml" ? input.compute_enabled ?? false : false,
    // La couverture suit la proposition : le challenge s'ouvre avec l'image
    // que la communauté a vue en la starant. L'admin peut la remplacer ensuite.
    cover_image_url: sandbox.cover_image_url ?? null,
    workspace_mode: type === "code" ? "own_repo" : null,
    // Un challenge de validation dérive d'un challenge ML existant : il ne peut
    // pas naître d'une proposition, donc ces trois colonnes restent nulles.
    source_challenge_id: null,
    cp_per_validation: null,
    required_validations: null,
  };
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
