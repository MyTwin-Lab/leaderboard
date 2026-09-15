import { z } from "zod";
import type { ProposableDeclaration } from "../../../packages/registry/platform.js";
import { httpUrlSchema } from "../../../packages/database-service/domain/schemas_zod.js";
import { parseGithubRepoUrl } from "../../../packages/services/challenge/repo-score.js";

const ML_ONLY = "Modèle et datasets n'existent que sur un sandbox ML";

/**
 * Les champs d'une proposition code : un dépôt, rien d'autre. Modèle et
 * datasets sont refusés plutôt qu'ignorés — acceptés, ils seraient invisibles
 * dans l'UI tout en polluant le contexte d'évaluation. `null` et `[]` passent :
 * ce sont les valeurs qu'écrit le miroir des anciennes colonnes.
 */
export const codeProposalFieldsSchema = z.object({
  repo_url: httpUrlSchema,
  model_url: z.null({ message: ML_ONLY }).optional(),
  dataset_urls: z.array(httpUrlSchema).max(0, { message: ML_ONLY }).default([]),
});

/** L'entrée de la source `github-snapshot` tirée du dépôt, `null` s'il n'est pas un dépôt GitHub lisible. */
function githubSnapshotInput(fields: Record<string, unknown>): { slug: string; branch?: string } | null {
  const target = parseGithubRepoUrl(typeof fields.repo_url === "string" ? fields.repo_url : undefined);
  return target ? { slug: target.slug, branch: target.branch } : null;
}

/**
 * La sandbox accepte des propositions code : l'auteur arrive avec son dépôt,
 * évalué par la grille `code` sur un snapshot GitHub. Promue, la proposition
 * devient un challenge `own_repo` sur ce dépôt — il n'y a pas de repo partagé à
 * provisionner ni de branche à créer.
 *
 * La source est nommée par sa clé : un flow n'importe pas une autre unité de
 * contenu, et la distribution vérifie qu'elle est installée.
 */
export const codeProposable: ProposableDeclaration = {
  fields: codeProposalFieldsSchema,
  evaluation: { bundleSource: "github-snapshot", grid: "code", input: githubSnapshotInput },
  promote: { flowConfig: () => ({ workspace_mode: "own_repo" }) },
};
