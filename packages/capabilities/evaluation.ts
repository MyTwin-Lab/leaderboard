import { OpenAIAgentEvaluator } from "../evaluator/evaluator.js";
import { EvaluationGridRegistry, type Grid } from "../evaluator/grids/index.js";
import type { CriterionScore, SnapshotInfo } from "../evaluator/types.js";
import {
  EvaluationRunContributionsRepository,
  EvaluationRunsRepository,
} from "../database-service/repositories/index.js";
import type { EvaluationRun, EvaluationRunMeta } from "../database-service/domain/entities.js";
import { PlatformRegistry, type EvaluationRetryOutcome } from "../registry/platform.js";
import { prepareBundle, releaseBundle } from "./bundle.js";

/**
 * Capacité `evaluate`
 * -------------------
 * Noter un bundle avec une grille : le seul chemin par lequel un flow, une
 * extension ou un module appelle l'agent d'évaluation.
 *
 * Le core ne sait pas d'où viennent les fichiers : une **source de bundle**
 * installée par la distribution les rassemble (un dépôt GitHub, un artefact
 * Kaggle, demain un formulaire ou un document déposé). Le core les écrit sur
 * disque, charge la grille, appelle l'agent, nettoie, et trace le tout dans
 * `evaluation_runs`. Ce qu'on fait de la note (des CP, un score formatif)
 * reste à l'appelant.
 */

/** Ce qu'une source rend : les fichiers, les références évaluées, et de quoi libérer ses ressources. */
export interface CollectedBundle {
  /** Les fichiers, contenu compris. Écrits sur disque par le core. */
  snapshot: SnapshotInfo;
  /** Ce qui a été lu : des SHA de commits, une version d'artefact… Transmis à l'agent. */
  refs: string[];
  /** Referme une connexion ouverte pour la collecte. Appelé une fois l'évaluation finie. */
  release?(): Promise<void>;
}

export interface BundleSource<Input = unknown> {
  key: string;
  collect(input: Input): Promise<CollectedBundle>;
}

interface BundleSourceState {
  sources: Map<string, BundleSource>;
}

const SOURCES_KEY = "__leaderboardBundleSourceRegistry";

function sourceState(): BundleSourceState {
  const holder = globalThis as unknown as Record<string, BundleSourceState | undefined>;
  holder[SOURCES_KEY] ??= { sources: new Map() };
  return holder[SOURCES_KEY]!;
}

/** Les sources de bundle installées. État sur `globalThis`, comme les connecteurs. */
export class BundleSourceRegistry {
  static register<Input>(source: BundleSource<Input>): void {
    const { sources } = sourceState();
    if (sources.has(source.key)) {
      throw new Error(`[BundleSourceRegistry] Bundle source "${source.key}" is registered twice`);
    }
    sources.set(source.key, source as BundleSource);
  }

  static get(key: string): BundleSource | undefined {
    return sourceState().sources.get(key);
  }

  static keys(): string[] {
    return [...sourceState().sources.keys()];
  }

  /** Vide le registre — réservé aux tests. */
  static clear(): void {
    sourceState().sources.clear();
  }
}

/** Ce que l'agent évalue. */
export interface EvaluationSubject {
  title: string;
  /** Le type annoncé à l'agent (`code`, le slug de la grille…). */
  type: string;
  /** Le contexte libre passé au prompt. */
  description?: string;
  /** Ce à quoi l'évaluation se rattache pour l'agent : un challenge, un sandbox… */
  ref: string;
  userId: string;
}

/**
 * Qui a lancé l'évaluation, et comment la rejouer.
 *
 * `owner` est la clé du flow, de l'extension ou du module appelant ; `handler`
 * et `payload` désignent le handler qu'il déclare (`evaluationHandlers`), que
 * le rejeu d'un run rappelle avec ce même `payload`.
 */
export interface EvaluationOrigin {
  owner: string;
  handler: string;
  payload: Record<string, unknown>;
  challengeId?: string | null;
  /** La contribution évaluée. Sans contribution, le sujet est rangé dans `meta.subject`. */
  contributionId?: string | null;
  createdBy?: string | null;
}

export interface EvaluateRequest {
  bundle: { source: string; input: unknown };
  gridSlug: string;
  subject: EvaluationSubject;
  /** Le drapeau `toMerge` de l'agent : une évaluation précédente existe. */
  hasPriorEvaluation?: boolean;
  origin: EvaluationOrigin;
}

export interface EvaluationOutcome {
  scores: CriterionScore[];
  /** Sur 0–9 : des notes 0–9 pondérées par des poids qui somment à ~1. */
  globalScore: number;
}

export interface EvaluateResult {
  /** `null` quand le run n'a pas pu être tracé ; l'évaluation, elle, a eu lieu. */
  runId: string | null;
  evaluation: EvaluationOutcome;
  refs: string[];
}

export interface RunHandle {
  runId: string;
  succeed(meta: EvaluationRunMeta): Promise<void>;
  fail(error: unknown): Promise<void>;
}

/** Trace les runs. Ne lève jamais : une trace manquante ne doit pas faire échouer une évaluation. */
export interface RunRecorder {
  start(request: EvaluateRequest): Promise<RunHandle | null>;
}

export interface EvaluationDeps {
  source(key: string): BundleSource | undefined;
  prepare(snapshot: SnapshotInfo): Promise<SnapshotInfo>;
  release(snapshot: SnapshotInfo): Promise<void>;
  loadGrid(slug: string): Promise<Grid>;
  agent: Pick<OpenAIAgentEvaluator, "evaluate">;
  runs: RunRecorder;
}

// Sans état, donc partagé : l'instancier à chaque évaluation ne servirait à rien.
let defaultAgent: OpenAIAgentEvaluator | null = null;

function defaultDeps(): EvaluationDeps {
  defaultAgent ??= new OpenAIAgentEvaluator();
  return {
    source: (key) => BundleSourceRegistry.get(key),
    prepare: prepareBundle,
    release: releaseBundle,
    loadGrid: (slug) => EvaluationGridRegistry.getGrid(slug),
    agent: defaultAgent,
    runs: databaseRunRecorder(),
  };
}

/**
 * Évalue un bundle et trace le run.
 *
 * La grille est chargée avant la collecte : une grille absente échoue sans
 * avoir sollicité GitHub ou Kaggle. Le workspace et la connexion de la source
 * sont libérés quoi qu'il arrive.
 */
export async function evaluate(request: EvaluateRequest, deps?: Partial<EvaluationDeps>): Promise<EvaluateResult> {
  const d: EvaluationDeps = { ...defaultDeps(), ...deps };
  const { bundle, gridSlug, subject } = request;
  const startedAt = Date.now();
  const run = await d.runs.start(request);

  try {
    const source = d.source(bundle.source);
    if (!source) throw new Error(`[evaluate] No bundle source "${bundle.source}" installed`);

    const grid = await d.loadGrid(gridSlug);
    const collected = await source.collect(bundle.input);
    try {
      const prepared = await d.prepare(collected.snapshot);
      try {
        const evaluation = await d.agent.evaluate(
          !!request.hasPriorEvaluation,
          {
            title: subject.title,
            type: subject.type,
            description: subject.description,
            challenge_id: subject.ref,
            userId: subject.userId,
            commitShas: collected.refs,
          },
          { snapshot: prepared, grid },
        );

        const outcome: EvaluationOutcome = { scores: evaluation.scores, globalScore: evaluation.globalScore };
        await run?.succeed({ durationMs: Date.now() - startedAt, globalScore: outcome.globalScore });
        return { runId: run?.runId ?? null, evaluation: outcome, refs: collected.refs };
      } finally {
        await d.release(prepared);
      }
    } finally {
      await collected.release?.().catch((error) => {
        console.warn(`[evaluate] Failed to release bundle source "${bundle.source}":`, error);
      });
    }
  } catch (error) {
    await run?.fail(error);
    throw error;
  }
}

interface RunRepositories {
  runs: Pick<EvaluationRunsRepository, "create" | "markSucceeded" | "markFailed">;
  links: Pick<EvaluationRunContributionsRepository, "create" | "updateStatus">;
}

/**
 * Le traceur par défaut : un `evaluation_runs` par appel, et une ligne
 * `evaluation_run_contributions` quand une contribution est évaluée.
 *
 * Chaque écriture est protégée : une base qui refuse la trace (schéma pas
 * encore appliqué, par exemple) laisse l'évaluation se faire, avec un log.
 */
export function databaseRunRecorder(repositories?: RunRepositories): RunRecorder {
  return {
    async start(request) {
      const { origin, subject, gridSlug, bundle } = request;
      const repos = repositories ?? {
        runs: new EvaluationRunsRepository(),
        links: new EvaluationRunContributionsRepository(),
      };

      const baseMeta: EvaluationRunMeta = {
        gridSlug,
        bundleSource: bundle.source,
        contributionCount: origin.contributionId ? 1 : 0,
        ...(origin.contributionId ? {} : { subject: { title: subject.title, type: subject.type, ref: subject.ref } }),
      };

      let runId: string;
      let linkId: string | null = null;
      try {
        const run = await repos.runs.create({
          challenge_id: origin.challengeId ?? undefined,
          trigger_type: origin.owner,
          trigger_payload: { handler: origin.handler, payload: origin.payload },
          status: "running",
          started_at: new Date(),
          created_by: origin.createdBy ?? undefined,
          meta: baseMeta,
        });
        runId = run.uuid;
        if (origin.contributionId) {
          const link = await repos.links.create({
            run_id: runId,
            contribution_id: origin.contributionId,
            status: "identified",
          });
          linkId = link.uuid;
        }
      } catch (error) {
        console.error(`[evaluate] Could not record the run of ${origin.owner}/${origin.handler}:`, error);
        return null;
      }

      const safely = async (label: string, write: () => Promise<unknown>) => {
        try {
          await write();
        } catch (error) {
          console.error(`[evaluate] Could not mark run ${runId} ${label}:`, error);
        }
      };

      return {
        runId,
        succeed: (meta) =>
          safely("succeeded", async () => {
            if (linkId) await repos.links.updateStatus(linkId, "evaluated");
            await repos.runs.markSucceeded(runId, { ...baseMeta, ...meta });
          }),
        fail: (error) =>
          safely("failed", async () => {
            const message = error instanceof Error ? error.message : String(error);
            if (linkId) await repos.links.updateStatus(linkId, "skipped", { skipReason: message });
            await repos.runs.markFailed(runId, error instanceof Error ? error.name : "Error", message);
          }),
      };
    },
  };
}

export type RetryRefusal = "not_failed" | "no_handler";

/**
 * Rejoue un run échoué en rappelant le handler que son propriétaire déclare.
 *
 * Seul un run `failed` se rejoue : un run réussi a déjà produit ses effets
 * (des lignes de ledger, un score stocké), et le relancer pourrait les
 * dupliquer selon le flow. Le handler relance l'évaluation en tâche de fond ;
 * le nouveau run apparaît à côté de l'ancien.
 */
export async function retryEvaluationRun(
  run: Pick<EvaluationRun, "status" | "trigger_type" | "trigger_payload">,
): Promise<EvaluationRetryOutcome | { ok: false; reason: RetryRefusal }> {
  if (run.status !== "failed") return { ok: false, reason: "not_failed" };

  const handlerKey = run.trigger_payload?.handler;
  const payload = run.trigger_payload?.payload;
  if (typeof handlerKey !== "string" || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "no_handler" };
  }

  const handler = PlatformRegistry.evaluationHandler(run.trigger_type, handlerKey);
  if (!handler) return { ok: false, reason: "no_handler" };

  return handler.retry(payload as Record<string, unknown>);
}
