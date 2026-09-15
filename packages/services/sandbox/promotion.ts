import type {
  ChallengeRepoRole,
  Contribution,
  Sandbox,
} from "../../database-service/domain/entities.js";
import { ML_ROLE_RULE } from "../challenge/mlRoles.js";
import { normalizeArtifactUrl } from "../challenge/artifactUrl.js";

/**
 * Promotion — la partie **pure**.
 * ------------------------------
 * Tout ce qui se décide sans base : le brouillon du challenge, la
 * participation de l'auteur, le `workspace_meta` des repos ML et les
 * contributions qui reprennent le travail déjà déposé dans la proposition.
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
  type: "code" | "ml";
  start_date: Date | null;
  end_date: Date | null;
  description: string | null;
  roadmap: string | null;
  contribution_points_reward: number;
  completion: number;
  project_id: string;
  reward_rules: unknown;
  /**
   * La configuration candidate, validée par le flow à l'écriture
   * (`prepareFlowConfig`) : le mode `own_repo` d'un challenge code, la
   * puissance de calcul d'un challenge ML.
   */
  flow_config: {
    workspace_mode?: "own_repo";
    extensions?: { compute: { enabled: boolean } };
  };
  source_challenge_id: null;
}

/** Le type du challenge que devient une proposition : hérité, jamais choisi. */
export function promotedChallengeType(sandbox: Pick<Sandbox, "type">): "code" | "ml" {
  return sandbox.type === "ml" ? "ml" : "code";
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
 * **Le type est hérité, jamais choisi.** Il a décidé des champs saisis, de la
 * grille d'évaluation et des repos à créer ; le laisser changer à la promotion
 * produirait un challenge ML sans dataset, ou un challenge code portant un
 * modèle. Le tiroir verrouille le sélecteur, cette fonction le garantit.
 *
 * `workspace_mode: 'own_repo'` est forcé pour un sandbox `code` : l'auteur
 * arrive avec son dépôt, il n'y a pas de repo partagé à provisionner ni de
 * branche à lui créer. La colonne reste NULL pour un `ml`, qui n'a pas de mode.
 */
export function buildPromotedChallengeDraft(
  sandbox: Pick<Sandbox, "type" | "title" | "context" | "goals" | "why">,
  input: PromotionInput,
): PromotedChallengeDraft {
  const type = promotedChallengeType(sandbox);
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
    flow_config:
      type === "code"
        ? { workspace_mode: "own_repo" }
        : { extensions: { compute: { enabled: input.compute_enabled ?? false } } },
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
 * exactement ce que pose `PATCH /api/challenges/:id/workspace` en mode
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

/** `workspace_meta` par rôle de repo ML, prêt à être posé sur `challenge_repos`. */
export type MlWorkspaceMetaSeed = Partial<Record<ChallengeRepoRole, Record<string, unknown>>>;

/**
 * Pré-remplit le workspace ML de l'auteur avec ce qu'il a déjà fourni.
 *
 * Les formes reproduites ici sont celles qu'écrit
 * `PATCH /api/challenges/:id/ml-workspace` : `userUrls[userId]` pour l'URL
 * propre de l'étape, `datasetUrls[userId]` pour l'ensemble des datasets
 * retenus. C'est pour ça que `sandboxes.dataset_urls` est un tableau (§1.2) —
 * la promotion recopie sans conversion.
 *
 * Un sandbox ML **sans modèle** est un état normal : aucune entrée n'est alors
 * écrite pour le rôle `model`, et l'étape s'affiche vide, comme pour un
 * contributeur qui n'a pas encore soumis.
 */
export function seedMlWorkspaceMeta(
  sandbox: Pick<Sandbox, "type" | "repo_url" | "model_url" | "dataset_urls">,
  authorId: string,
): MlWorkspaceMetaSeed {
  if (sandbox.type !== "ml") return {};

  const seed: MlWorkspaceMetaSeed = {};

  const datasetUrls = (sandbox.dataset_urls ?? []).filter(Boolean);
  if (datasetUrls.length > 0) {
    seed.dataset = {
      // La première URL est celle du formulaire (« Starting point »), les
      // autres sont des datasets additionnels retenus pour construire le modèle.
      userUrls: { [authorId]: datasetUrls[0] },
      datasetUrls: { [authorId]: [...datasetUrls] },
    };
  }

  if (sandbox.model_url) {
    seed.model = { userUrls: { [authorId]: sandbox.model_url } };
  }

  seed.model_code = { userUrls: { [authorId]: sandbox.repo_url } };

  return seed;
}

/**
 * Une contribution à créer au moment de la promotion, avec l'URL qui doit
 * ensuite être scorée pour ce rôle.
 */
export interface PromotedContributionDraft {
  role: ChallengeRepoRole;
  /** L'artefact soumis pour ce rôle — passé tel quel à `MlRewardsService`. */
  url: string;
  /** Prête pour `ContributionRepository.create`, sans conversion. */
  contribution: Omit<Contribution, "uuid" | "created_at">;
}

/**
 * **La reprise du travail de l'auteur.**
 *
 * Sur un challenge, déposer un dataset, un modèle ou du code *est* une
 * contribution créditée : rien ne justifie d'imposer à l'auteur de re-soumettre
 * ce qu'il a déjà fourni dans sa proposition. La promotion crée donc les
 * contributions correspondantes, et le scoring normal les crédite sur le pool
 * du challenge.
 *
 * Deux rôles seulement, et c'est `ML_ROLE_RULE` qui le dit :
 * - `dataset` (grille `dataset`) — l'URL du dataset ;
 * - `model_code` (grille `code`) — le dépôt de l'auteur.
 *
 * Le rôle `model` n'a **pas** de grille : il se score sur une métrique Kaggle
 * que la proposition ne porte pas. Il sera crédité quand l'auteur soumettra sa
 * métrique depuis le challenge — d'où sa contribution créée ici (l'étape modèle
 * n'a qu'une contribution pour ses deux repos) mais jamais scorée sur ce
 * chemin. `api` n'est pas repris : un sandbox n'a pas d'endpoint déployé.
 *
 * Vide pour un sandbox `code` : son dépôt est rattaché en `own_repo`, et le
 * cycle d'évaluation du challenge crée lui-même la contribution projet.
 */
export function buildAuthorContributions(
  sandbox: Pick<Sandbox, "type" | "user_id" | "repo_url" | "model_url" | "dataset_urls">,
  challengeId: string,
  now: Date = new Date(),
): PromotedContributionDraft[] {
  if (sandbox.type !== "ml") return [];

  const drafts: PromotedContributionDraft[] = [];
  const datasetUrl = (sandbox.dataset_urls ?? []).filter(Boolean)[0];

  if (datasetUrl) {
    drafts.push({
      role: "dataset",
      url: datasetUrl,
      contribution: {
        title: ML_ROLE_RULE.dataset.title,
        type: ML_ROLE_RULE.dataset.contributionType,
        description: `dataset: ${datasetUrl}`,
        reward: 0,
        user_id: sandbox.user_id,
        challenge_id: challengeId,
        // Le dataset identifie l'étape : c'est son URL normalisée qui sert à
        // détecter une réutilisation entre contributeurs.
        artifact_url: normalizeArtifactUrl(datasetUrl),
        evaluation_status: "pending",
        submitted_at: now,
      },
    });
  }

  // L'étape modèle rassemble ses deux repos sur une seule contribution, dans
  // l'ordre des repos du challenge (model puis model_code) — même description
  // que celle construite par la route ml-workspace.
  const modelLines = [
    sandbox.model_url ? `model: ${sandbox.model_url}` : null,
    `model_code: ${sandbox.repo_url}`,
  ].filter(Boolean) as string[];

  drafts.push({
    role: "model_code",
    url: sandbox.repo_url,
    contribution: {
      title: ML_ROLE_RULE.model.title,
      type: ML_ROLE_RULE.model_code.contributionType,
      description: modelLines.join("\n"),
      reward: 0,
      user_id: sandbox.user_id,
      challenge_id: challengeId,
      // Pas d'`artifact_url` : le code du modèle n'identifie pas l'étape, le
      // modèle Kaggle si — et il n'est pas encore soumis.
      evaluation_status: "pending",
      submitted_at: now,
    },
  });

  return drafts;
}
