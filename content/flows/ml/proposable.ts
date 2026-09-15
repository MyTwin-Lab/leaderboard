import { z } from "zod";
import type { ProposableDeclaration, ProposalPromotion } from "../../../packages/registry/platform.js";
import type { Contribution } from "../../../packages/database-service/domain/entities.js";
import { httpUrlSchema } from "../../../packages/database-service/domain/schemas_zod.js";
import { parseGithubRepoUrl } from "../../../packages/services/challenge/repo-score.js";
import type { MlSubmissionEvent } from "../../../packages/services/challenge/ml-rewards.service.js";
import {
  buildAuthorContributions,
  mlEvaluationContext,
  mlProposalFieldsOf,
  seedMlWorkspaceMeta,
} from "./proposal.js";

/**
 * Les champs d'une proposition ML : le dépôt du code du modèle et au moins un
 * dataset. Le modèle reste optionnel — une proposition ML peut démarrer avant
 * d'avoir produit un artefact — et `null` le vide à l'édition.
 */
export const mlProposalFieldsSchema = z.object({
  repo_url: httpUrlSchema,
  model_url: httpUrlSchema.nullish(),
  dataset_urls: z
    .array(httpUrlSchema)
    .min(1, { message: "Un sandbox ML demande au moins une URL de dataset" })
    .max(10),
});

export interface AuthorWorkDeps {
  createContribution(contribution: Omit<Contribution, "uuid" | "created_at">): Promise<unknown>;
  /** **Le** chemin de scoring ML, celui d'une soumission faite depuis le challenge. */
  award(event: MlSubmissionEvent): Promise<void>;
}

// Import à la demande : déclarer le flow ne charge ni les repositories ni l'agent.
async function defaultAuthorWorkDeps(): Promise<AuthorWorkDeps> {
  const [{ ContributionRepository }, { MlRewardsService }] = await Promise.all([
    import("../../../packages/database-service/repositories/index.js"),
    import("../../../packages/services/challenge/ml-rewards.service.js"),
  ]);
  const contributions = new ContributionRepository();
  return {
    createContribution: (contribution) => contributions.create(contribution),
    award: (event) => new MlRewardsService().award(event),
  };
}

/**
 * Après la promotion, les contributions de l'auteur sont créées puis scorées
 * sur le pool du challenge.
 *
 * **Séquentiel, et pas en parallèle.** Chaque award calcule ce qu'il reste au
 * pool avant d'écrire ses lignes de ledger ; deux awards concurrents liraient
 * le même reste et pourraient, ensemble, dépasser le pool.
 */
export async function resumeAuthorWork(
  context: Parameters<NonNullable<ProposalPromotion["afterPromote"]>>[0],
  deps?: AuthorWorkDeps,
): Promise<void> {
  const drafts = buildAuthorContributions(mlProposalFieldsOf(context.fields), context.authorId, context.challengeId);
  if (drafts.length === 0) return;

  const d = deps ?? (await defaultAuthorWorkDeps());
  for (const draft of drafts) {
    const repoId = context.repoIdsByRole[draft.role];
    // Un rôle sans repo ne peut pas être scoré : `award` résout la règle
    // depuis `challenge_repos`, pas depuis la contribution.
    if (!repoId) continue;

    await d.createContribution(draft.contribution);
    await d.award({ challengeId: context.challengeId, userId: context.authorId, repoId, url: draft.url });
  }
}

/**
 * La sandbox accepte des propositions ML. Évaluées avec la grille `code` : un
 * sandbox n'a que du code à snapshoter, le rôle modèle se scorant sur une
 * métrique et non sur une grille. Les artefacts vont au contexte de l'agent.
 *
 * Promue, la proposition devient un challenge ML (puissance de calcul selon le
 * tiroir), avec le workspace de l'auteur rempli et son travail repris.
 */
export const mlProposable: ProposableDeclaration = {
  fields: mlProposalFieldsSchema,
  evaluation: {
    // La source est nommée par sa clé : la distribution vérifie qu'elle est installée.
    bundleSource: "github-snapshot",
    grid: "code",
    input(fields) {
      const target = parseGithubRepoUrl(typeof fields.repo_url === "string" ? fields.repo_url : undefined);
      return target ? { slug: target.slug, branch: target.branch } : null;
    },
    context: (fields) => mlEvaluationContext(mlProposalFieldsOf(fields)),
  },
  promote: {
    flowConfig: ({ compute_enabled }) => ({ extensions: { compute: { enabled: compute_enabled ?? false } } }),
    workspaceMeta: (fields, authorId) =>
      seedMlWorkspaceMeta(mlProposalFieldsOf(fields), authorId) as Record<string, Record<string, unknown>>,
    afterPromote: (context) => resumeAuthorWork(context),
  },
};
