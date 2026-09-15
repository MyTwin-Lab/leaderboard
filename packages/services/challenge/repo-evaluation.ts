import { evaluate, type EvaluationOrigin } from "../../capabilities/evaluation.js";
import { GITHUB_SNAPSHOT_SOURCE, type GithubSnapshotInput } from "../../../content/bundle-sources/github-snapshot/index.js";
import { toScore10 } from "./repo-score.js";

/**
 * repo-evaluation
 * ---------------
 * Évaluer un dépôt GitHub : la capacité `evaluate` du core, nourrie par la
 * source `github-snapshot`, et la note ramenée sur 10.
 *
 * Deux appelants :
 * - le challenge code, qui transforme la note en CP (`code-rewards.service.ts`) ;
 * - le sandbox, dont l'évaluation est **formative** et ne paie rien
 *   (`services/sandbox/sandbox-evaluation.service.ts`).
 *
 * Ce module ne connaît ni challenge, ni sandbox, ni ledger : il rend une note
 * et le détail des critères, et c'est à l'appelant de décider ce qu'il en fait.
 * Le run, lui, est tracé par la capacité, au nom de l'appelant (`origin`).
 *
 * Les deux helpers purs vivent dans `repo-score.ts` et sont ré-exportés ici :
 * l'UI les importe de là-bas, ce fichier n'étant pas bundlable côté navigateur.
 */
export { parseGithubRepoUrl, toScore10 } from "./repo-score.js";

/** Ce que l'agent évalue : un titre, un contexte textuel, et à qui c'est rattaché. */
export interface RepoEvaluationSubject {
  title: string;
  /** Le type de contribution annoncé à l'agent — `code` pour un repo. */
  type: string;
  /**
   * Le contexte libre passé au prompt. Pour un challenge, la description de la
   * contribution ; pour un sandbox, son contexte plus, le cas échéant, les URLs
   * de datasets et de modèle (§1.3 du plan).
   */
  description?: string;
  /** Ce à quoi l'évaluation se rattache : un challenge, ou un sandbox. */
  challengeId: string;
  userId: string;
}

export interface RepoEvaluationInput {
  /** `owner/repo`, tel que `parseGithubRepoUrl` le rend. */
  slug: string;
  branch?: string;
  /** Le slug de grille à charger. `code` pour les deux types de sandbox (§1.3). */
  gridSlug: string;
  subject: RepoEvaluationSubject;
  /** Le drapeau `toMerge` de l'évaluateur : y a-t-il déjà une évaluation à fusionner. */
  hasPriorEvaluation: boolean;
  /** Plafond de commits agrégés dans le snapshot. */
  maxCommits?: number;
  /** Qui évalue, et quel handler rejoue le run. */
  origin: EvaluationOrigin;
}

/** Isole la capacité (réseau, disque, base) — remplacée par une doublure en test. */
export interface RepoEvaluationDeps {
  evaluate: typeof evaluate;
}

export interface RepoEvaluationResult {
  /** La note ramenée sur 10, prête pour le calcul de CP ou pour l'affichage. */
  score10: number;
  /** Ce qui est stocké : le détail des critères et le score brut sur 9. */
  evaluation: { scores: unknown; globalScore: number };
}

export async function evaluateGithubRepo(
  input: RepoEvaluationInput,
  deps?: Partial<RepoEvaluationDeps>,
): Promise<RepoEvaluationResult> {
  const { slug, branch, gridSlug, subject, hasPriorEvaluation, maxCommits, origin } = input;
  const bundleInput: GithubSnapshotInput = { slug, branch, maxCommits };

  const { evaluation } = await (deps?.evaluate ?? evaluate)({
    bundle: { source: GITHUB_SNAPSHOT_SOURCE, input: bundleInput },
    gridSlug,
    subject: {
      title: subject.title,
      type: subject.type,
      description: subject.description,
      ref: subject.challengeId,
      userId: subject.userId,
    },
    hasPriorEvaluation,
    origin,
  });

  return {
    score10: toScore10(evaluation.globalScore),
    evaluation: { scores: evaluation.scores, globalScore: evaluation.globalScore },
  };
}
