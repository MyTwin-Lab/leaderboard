import { OpenAIAgentEvaluator } from "../../evaluator/evaluator.js";
import {
  EvaluationGridRegistry,
  type DetailedEvaluationGridTemplate,
  type EvaluationGridTemplate,
} from "../../evaluator/grids/index.js";
import type { EvaluateContext, SnapshotInfo } from "../../evaluator/types.js";
import type { ExternalConnector } from "../../connectors/interfaces.js";
import type { Repo } from "../../database-service/domain/entities.js";
import { ConnectorRegistry } from "../../connectors/registry.js";
import { SnapshotService } from "./snapshot.service.js";
import { DatabaseGridProvider } from "../database-grid-provider.js";
import { toScore10 } from "./repo-score.js";

/**
 * repo-evaluation
 * ---------------
 * Le cœur partagé de l'évaluation d'un dépôt GitHub : cloner l'état du repo
 * dans un snapshot agrégé, charger une grille par son slug, appeler l'agent.
 *
 * Extrait de `CodeRewardsService.runAgentDefault`, dont il est la copie
 * conforme, parce que deux appelants en ont désormais besoin :
 * - le challenge code, qui transforme la note en CP (`code-rewards.service.ts`) ;
 * - le sandbox, dont l'évaluation est **formative** et ne paie rien
 *   (`services/sandbox/sandbox-evaluation.service.ts`).
 *
 * Ce module ne connaît ni challenge, ni sandbox, ni ledger : il rend une note
 * et le détail des critères, et c'est à l'appelant de décider ce qu'il en fait.
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
}

/** Isole les accès réseau (GitHub, OpenAI) et disque — remplacés par des doublures en test. */
export interface RepoEvaluationDeps {
  createConnector: (repo: Repo, options?: { branch?: string }) => Promise<ExternalConnector | null>;
  snapshotService: Pick<SnapshotService, "buildAggregatedSnapshot" | "prepareSnapshot" | "cleanup">;
  loadGrid: (slug: string) => Promise<EvaluationGridTemplate | DetailedEvaluationGridTemplate>;
  evaluator: Pick<OpenAIAgentEvaluator, "evaluate">;
}

export interface RepoEvaluationResult {
  /** La note ramenée sur 10, prête pour le calcul de CP ou pour l'affichage. */
  score10: number;
  /** Ce qui est stocké : le détail des critères et le score brut sur 9. */
  evaluation: { scores: unknown; globalScore: number };
}

// Sans état, donc partagés : les instancier à chaque run ne servirait à rien.
const defaultSnapshotService = new SnapshotService();
const defaultEvaluator = new OpenAIAgentEvaluator();

let databaseGridProviderInstalled = false;

/**
 * Branche le fournisseur de grilles en base sur le registre.
 *
 * Le registre est statique : une seule installation suffit pour tout le
 * processus. C'est ce qui fait qu'une grille `code` publiée en base est servie
 * au sandbox comme au challenge, sans une ligne de code de plus (§1.3).
 */
export function ensureDatabaseGridProvider(): void {
  if (databaseGridProviderInstalled) return;
  EvaluationGridRegistry.setDatabaseProvider(new DatabaseGridProvider());
  databaseGridProviderInstalled = true;
}

/**
 * Snapshot agrégé (≤ `maxCommits`) sur la branche/le repo, grille chargée par
 * slug, note ramenée /10.
 *
 * Le `disconnect` est dans un `finally` : le connecteur tient une ressource
 * réseau, et une évaluation qui échoue ne doit pas la laisser ouverte.
 */
export async function evaluateGithubRepo(
  input: RepoEvaluationInput,
  deps?: Partial<RepoEvaluationDeps>,
): Promise<RepoEvaluationResult> {
  const { slug, branch, gridSlug, subject, hasPriorEvaluation, maxCommits = 100 } = input;

  const createConnector =
    deps?.createConnector ??
    ((repo: Repo, options?: { branch?: string }) => ConnectorRegistry.createConnector(repo, options));
  const snapshotService = deps?.snapshotService ?? defaultSnapshotService;
  const loadGrid =
    deps?.loadGrid ??
    ((type: string) => {
      ensureDatabaseGridProvider();
      return EvaluationGridRegistry.getGridAsync(type);
    });
  const evaluator = deps?.evaluator ?? defaultEvaluator;

  const connector = await createConnector(
    { uuid: "", title: slug, type: "github", external_repo_id: slug, project_id: "" },
    branch ? { branch } : undefined,
  );
  if (!connector) throw new Error(`[repo-evaluation] No GitHub connector for ${slug}`);

  await connector.connect();
  try {
    const items = await connector.fetchItems();
    const shas = items.slice(0, maxCommits).map((i) => i.id);
    if (shas.length === 0) {
      throw new Error(`[repo-evaluation] No commits found on ${slug}${branch ? `@${branch}` : ""}`);
    }

    const aggregated = await snapshotService.buildAggregatedSnapshot(() => connector, shas);
    if (!aggregated) throw new Error(`[repo-evaluation] Unable to build snapshot for ${slug}`);
    const prepared = await snapshotService.prepareSnapshot(aggregated);

    // Le workspace contient le code du dépôt évalué : il est supprimé dès la
    // fin de l'évaluation, qu'elle réussisse ou lève.
    try {
      const grid = await loadGrid(gridSlug);
      const evalContext: EvaluateContext = { snapshot: prepared as SnapshotInfo, grid };

      const evaluation = await evaluator.evaluate(
        hasPriorEvaluation,
        {
          title: subject.title,
          type: subject.type,
          description: subject.description,
          challenge_id: subject.challengeId,
          userId: subject.userId,
          commitShas: shas,
        },
        evalContext,
      );

      return {
        score10: toScore10(evaluation.globalScore),
        evaluation: { scores: evaluation.scores, globalScore: evaluation.globalScore },
      };
    } finally {
      await snapshotService.cleanup(prepared);
    }
  } finally {
    await connector.disconnect?.();
  }
}
