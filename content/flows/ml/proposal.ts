import type { ChallengeRepoRole, Contribution } from "../../../packages/database-service/domain/entities.js";
import { ML_ROLE_RULE } from "../../../packages/services/challenge/mlRoles.js";
import { normalizeArtifactUrl } from "../../../packages/services/challenge/artifactUrl.js";

/**
 * Proposition ML — la partie **pure**
 * -----------------------------------
 * Ce que la promotion d'une proposition ML décide sans base : le
 * `workspace_meta` des repos et les contributions qui reprennent le travail
 * déjà déposé. `proposable.ts` les branche sur la promotion.
 */

/** Les champs d'une proposition ML, lus défensivement. */
export interface MlProposalFields {
  repo_url: string;
  model_url: string | null;
  dataset_urls: string[];
}

export function mlProposalFieldsOf(fields: Record<string, unknown>): MlProposalFields {
  return {
    repo_url: typeof fields.repo_url === "string" ? fields.repo_url : "",
    model_url: typeof fields.model_url === "string" && fields.model_url ? fields.model_url : null,
    dataset_urls: Array.isArray(fields.dataset_urls)
      ? fields.dataset_urls.filter((url): url is string => typeof url === "string" && url.length > 0)
      : [],
  };
}

/**
 * Les artefacts donnés à l'agent de l'évaluation formative. C'est là, et pas
 * dans la grille (`code` pour les deux flows), que se joue la différence avec
 * une proposition code. Sans modèle, aucune ligne `Model artifact:` : démarrer
 * sans artefact est un état normal.
 */
export function mlEvaluationContext(fields: MlProposalFields): string[] {
  const lines: string[] = [];
  if (fields.model_url) lines.push(`Model artifact: ${fields.model_url}`);
  if (fields.dataset_urls.length > 0) lines.push(`Datasets: ${fields.dataset_urls.join(", ")}`);
  return lines;
}

/** `workspace_meta` par rôle de repo ML, prêt à être posé sur `challenge_repos`. */
export type MlWorkspaceMetaSeed = Partial<Record<ChallengeRepoRole, Record<string, unknown>>>;

/**
 * Pré-remplit le workspace ML de l'auteur avec ce qu'il a déjà fourni.
 *
 * Les formes reproduites ici sont celles qu'écrit l'action `workspace` du flow :
 * `userUrls[userId]` pour l'URL propre de l'étape, `datasetUrls[userId]` pour
 * l'ensemble des datasets retenus — la promotion recopie sans conversion.
 *
 * Sans modèle, aucune entrée n'est écrite pour le rôle `model`, et l'étape
 * s'affiche vide, comme pour un contributeur qui n'a pas encore soumis.
 */
export function seedMlWorkspaceMeta(fields: MlProposalFields, authorId: string): MlWorkspaceMetaSeed {
  const seed: MlWorkspaceMetaSeed = {};

  if (fields.dataset_urls.length > 0) {
    seed.dataset = {
      // La première URL est celle du formulaire (« Starting point »), les
      // autres sont des datasets additionnels retenus pour construire le modèle.
      userUrls: { [authorId]: fields.dataset_urls[0] },
      datasetUrls: { [authorId]: [...fields.dataset_urls] },
    };
  }

  if (fields.model_url) {
    seed.model = { userUrls: { [authorId]: fields.model_url } };
  }

  seed.model_code = { userUrls: { [authorId]: fields.repo_url } };

  return seed;
}

/** Une contribution à créer à la promotion, avec l'URL à scorer ensuite pour ce rôle. */
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
 * ce qu'il a déjà fourni dans sa proposition.
 *
 * Deux rôles seulement, et c'est `ML_ROLE_RULE` qui le dit :
 * - `dataset` (grille `dataset`) — l'URL du dataset ;
 * - `model_code` (grille `code`) — le dépôt de l'auteur.
 *
 * Le rôle `model` n'a **pas** de grille : il se score sur une métrique Kaggle
 * que la proposition ne porte pas. Sa contribution est créée ici (l'étape
 * modèle n'a qu'une contribution pour ses deux repos) mais jamais scorée sur ce
 * chemin. `api` n'est pas repris : une proposition n'a pas d'endpoint déployé.
 */
export function buildAuthorContributions(
  fields: MlProposalFields,
  authorId: string,
  challengeId: string,
  now: Date = new Date(),
): PromotedContributionDraft[] {
  const drafts: PromotedContributionDraft[] = [];
  const datasetUrl = fields.dataset_urls[0];

  if (datasetUrl) {
    drafts.push({
      role: "dataset",
      url: datasetUrl,
      contribution: {
        title: ML_ROLE_RULE.dataset.title,
        type: ML_ROLE_RULE.dataset.contributionType,
        description: `dataset: ${datasetUrl}`,
        reward: 0,
        user_id: authorId,
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
  // que celle construite par l'action workspace.
  const modelLines = [
    fields.model_url ? `model: ${fields.model_url}` : null,
    `model_code: ${fields.repo_url}`,
  ].filter(Boolean) as string[];

  drafts.push({
    role: "model_code",
    url: fields.repo_url,
    contribution: {
      title: ML_ROLE_RULE.model.title,
      type: ML_ROLE_RULE.model_code.contributionType,
      description: modelLines.join("\n"),
      reward: 0,
      user_id: authorId,
      challenge_id: challengeId,
      // Pas d'`artifact_url` : le code du modèle n'identifie pas l'étape, le
      // modèle Kaggle si — et il n'est pas encore soumis.
      evaluation_status: "pending",
      submitted_at: now,
    },
  });

  return drafts;
}
