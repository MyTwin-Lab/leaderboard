import type { Sandbox } from "../../database-service/domain/entities.js";

/**
 * Promotion — la partie **pure**.
 * ------------------------------
 * Tout ce qui se décide sans base et sans connaître le flow : le brouillon du
 * challenge et la participation de l'auteur. Ce que le flow décide (sa
 * configuration, le `workspace_meta` de ses repos, la reprise du travail) vient
 * de sa déclaration `proposable.promote`.
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
   * Présents pour être **ignorés**, pas pour être lus : le type est hérité de
   * la proposition et le mode de workspace en découle. Les typer ici rend le
   * fait explicite plutôt que de le laisser à un `Omit` silencieux.
   */
  type?: unknown;
  workspace_mode?: unknown;
}

/** La ligne `challenges` à insérer, dans le vocabulaire du domaine. */
export interface PromotedChallengeDraft {
  title: string;
  status: string;
  /** La clé du flow de la proposition. */
  type: string;
  start_date: Date | null;
  end_date: Date | null;
  description: string | null;
  roadmap: string | null;
  contribution_points_reward: number;
  completion: number;
  project_id: string;
  reward_rules: unknown;
  /**
   * La configuration candidate que pose le flow (`proposable.promote.flowConfig`),
   * validée par le flow à l'écriture (`prepareFlowConfig`).
   */
  flow_config: Record<string, unknown>;
  source_challenge_id: null;
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
 * **Le type est hérité, jamais choisi.** Il a décidé des champs saisis, de
 * l'évaluation et des repos à créer ; le laisser changer à la promotion
 * produirait un challenge dont le flow ne sait pas lire la proposition. Le
 * tiroir verrouille le sélecteur, cette fonction le garantit.
 */
export function buildPromotedChallengeDraft(
  sandbox: Pick<Sandbox, "type" | "title" | "context" | "goals" | "why">,
  input: PromotionInput,
  flowConfig: Record<string, unknown> = {},
): PromotedChallengeDraft {
  const description = trimmed(input.description) || buildPromotedDescription(sandbox);

  return {
    title: trimmed(input.title) || sandbox.title,
    status: input.status,
    type: sandbox.type,
    start_date: toDate(input.start_date),
    end_date: toDate(input.end_date),
    description: description || null,
    roadmap: trimmed(input.roadmap) || null,
    contribution_points_reward: input.contribution_points_reward,
    completion: 0,
    project_id: input.project_id,
    reward_rules: input.reward_rules ?? null,
    flow_config: flowConfig,
    // Un challenge de validation dérive d'un challenge existant : il ne peut
    // pas naître d'une proposition.
    source_challenge_id: null,
  };
}

/** La row `challenge_teams` de l'auteur. */
export interface AuthorParticipation {
  challenge_id: string;
  user_id: string;
  workspace_provider: "external";
  workspace_url: string;
  workspace_status: "ready";
}

/**
 * L'auteur devient membre de son challenge, avec son dépôt déjà déclaré.
 *
 * `workspace_provider: 'external'` et `workspace_status: 'ready'` sont
 * exactement ce que pose l'action `workspace` d'un challenge code en mode
 * `own_repo` : l'auteur n'a donc rien à re-saisir, et `CodeRewardsService`
 * trouve sa cible dès la première évaluation. Sur un challenge ML les colonnes
 * de workspace ne sont pas lues (les URLs vivent dans `workspace_meta`), mais
 * les renseigner reste exact — c'est bien le dépôt de l'auteur.
 */
export function buildAuthorParticipation(
  sandbox: Pick<Sandbox, "user_id" | "repo_url">,
  challengeId: string,
): AuthorParticipation {
  return {
    challenge_id: challengeId,
    user_id: sandbox.user_id,
    workspace_provider: "external",
    workspace_url: sandbox.repo_url,
    workspace_status: "ready",
  };
}
