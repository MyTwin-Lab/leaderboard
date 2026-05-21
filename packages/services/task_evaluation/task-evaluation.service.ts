import { OpenAIAgentEvaluator } from "../../evaluator/evaluator.js";
import { EvaluationGridRegistry } from "../../evaluator/grids/index.js";
import type { AgentEvaluator } from "../../evaluator/interfaces.js";
import type {
  Evaluation,
  EvaluateContext,
  SnapshotInfo,
  Contribution as EvalContribution,
} from "../../evaluator/types.js";
import type { Challenge, Contribution, Task } from "../../database-service/domain/entities.js";
import { ContributionRepository } from "../../database-service/repositories/index.js";
import { ConnectorRegistry } from "../../connectors/registry.js";
import { ConnectorsOrchestrator } from "../../connectors/connectors.orchestrator.js";
import type { ExternalConnector } from "../../connectors/interfaces.js";
import { SnapshotService } from "../evaluation/snapshot.service.js";
import { DatabaseGridProvider } from "../evaluation/database-grid-provider.js";
import { RunLogger } from "../evaluation/run-logger.js";
import { TaskContextService, type TaskWorkspaceInfo } from "./task-context.service.js";

export interface TaskEvaluationOptions {
  userId: string;
  taskId: string;
}

export interface TaskEvaluationResult {
  evaluation: Evaluation;
  contribution: Contribution;
  isUpdate: boolean;
}

/**
 * TaskEvaluationService
 * ---------------------
 * Service d'évaluation d'une task individuelle.
 * Pipeline : context → connect → snapshot → evaluate → upsert → log.
 */
export class TaskEvaluationService {
  private contextService: TaskContextService;
  private snapshotService: SnapshotService;
  private evaluator: AgentEvaluator;
  private contributionRepo: ContributionRepository;
  private runLogger: RunLogger;
  private static dbProviderInitialized = false;

  constructor(
    contextService: TaskContextService = new TaskContextService(),
    snapshotService: SnapshotService = new SnapshotService(),
    evaluator: AgentEvaluator = new OpenAIAgentEvaluator(),
    contributionRepo: ContributionRepository = new ContributionRepository(),
    runLogger: RunLogger = new RunLogger()
  ) {
    this.contextService = contextService;
    this.snapshotService = snapshotService;
    this.evaluator = evaluator;
    this.contributionRepo = contributionRepo;
    this.runLogger = runLogger;

    if (!TaskEvaluationService.dbProviderInitialized) {
      EvaluationGridRegistry.setDatabaseProvider(new DatabaseGridProvider());
      TaskEvaluationService.dbProviderInitialized = true;
      console.log("[TaskEvaluationService] DatabaseGridProvider initialized");
    }
  }

  /**
   * Évalue une task pour un utilisateur donné.
   * Si une contribution existe déjà pour (task_id, user_id), elle est mise à jour.
   */
  async evaluateTask(options: TaskEvaluationOptions): Promise<TaskEvaluationResult> {
    const { userId, taskId } = options;
    console.log(`\n🔄 [TaskEvaluationService] Évaluation de la task ${taskId} pour l'utilisateur ${userId}`);

    const { challenge, task, workspaces } = await this.contextService.getTaskContext(taskId, userId);
    console.log(`   - Challenge: ${challenge.title} | Task: ${task.title} | Workspaces: ${workspaces.length}`);

    if (workspaces.length === 0) {
      throw new Error(`[TaskEvaluationService] No workspace found for task ${taskId}`);
    }

    const runId = await this.startRun(challenge.uuid, taskId, userId);
    const orchestrator = this.createOrchestrator(workspaces);
    await orchestrator.connectAll();

    try {
      const { snapshot, commitShas } = await this.buildSnapshot(orchestrator, taskId);
      const { grid, gridSlug }       = await this.loadGrid(workspaces);
      const existing                 = await this.contributionRepo.findByTaskAndUser(taskId, userId);
      const evalContribution         = this.buildEvalContribution(task, challenge, userId, gridSlug, commitShas, existing);

      console.log(`[TaskEvaluationService] 📊 Évaluation (${existing ? 'mise à jour' : 'nouvelle'})...`);
      const evaluation = await this.evaluator.evaluate(!!existing, evalContribution, { snapshot, grid } as EvaluateContext);
      evaluation.contribution = evalContribution;

      const saved = await this.upsertContribution(existing, evaluation, challenge.uuid, taskId, userId);
      await this.finalizeRun(runId, saved.uuid);

      console.log(`[TaskEvaluationService] ✅ Score: ${evaluation.globalScore} | ${existing ? 'updated' : 'created'} | run: ${runId}`);
      return { evaluation, contribution: saved, isUpdate: !!existing };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.runLogger.markFailed(runId, 'TASK_EVALUATION_ERROR', errorMessage);
      throw error;
    } finally {
      await orchestrator.disconnectAll();
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline steps
  // ---------------------------------------------------------------------------

  private async startRun(challengeId: string, taskId: string, userId: string): Promise<string> {
    const now = new Date();
    return this.runLogger.startRun({
      challengeId,
      triggerType: 'manual',
      triggerPayload: { taskId, userId },
      windowStart: now,
      windowEnd: now,
      createdBy: userId,
    });
  }

  private async buildSnapshot(
    orchestrator: ConnectorsOrchestrator,
    taskId: string
  ): Promise<{ snapshot: SnapshotInfo; commitShas: string[] }> {
    const allItems = await orchestrator.fetchAllItems({ maxCommits: 100 });
    const commitShas = allItems.map(item => item.id);

    console.log(`   - ${commitShas.length} commit(s) trouvé(s)`);

    if (commitShas.length === 0) {
      throw new Error(`[TaskEvaluationService] No commits found on task branches for task ${taskId}`);
    }

    const resolveConnector = (sha: string) => orchestrator.getConnectorForItem(sha);
    const aggregated = await this.snapshotService.buildAggregatedSnapshot(resolveConnector, commitShas);

    if (!aggregated) {
      throw new Error(`[TaskEvaluationService] Unable to build snapshot for task ${taskId}`);
    }

    const snapshot = await this.snapshotService.prepareSnapshot(aggregated);
    return { snapshot: snapshot as SnapshotInfo, commitShas };
  }

  private async loadGrid(workspaces: TaskWorkspaceInfo[]): Promise<{ grid: Awaited<ReturnType<typeof EvaluationGridRegistry.getGridAsync>>; gridSlug: string }> {
    const gridSlug = this.resolveGridSlug(workspaces);
    const grid = await EvaluationGridRegistry.getGridAsync(gridSlug);
    return { grid, gridSlug };
  }

  private buildEvalContribution(
    task: Task,
    challenge: Challenge,
    userId: string,
    gridSlug: string,
    commitShas: string[],
    existing: Contribution | null
  ): EvalContribution {
    const contrib: EvalContribution = {
      title: task.title,
      type: gridSlug,
      description: task.description,
      challenge_id: challenge.uuid,
      userId,
      commitShas,
    };
    if (existing?.evaluation) {
      (contrib as any).evaluation = existing.evaluation;
    }
    return contrib;
  }

  private async finalizeRun(runId: string, contributionId: string): Promise<void> {
    await this.runLogger.logContributions(runId, [{
      contributionId,
      status: 'evaluated' as const,
    }]);
    await this.runLogger.markSucceeded(runId, {
      contributionCount: 1,
      evaluatorVersion: '1.0.0',
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private resolveGridSlug(workspaces: TaskWorkspaceInfo[]): string {
    const repoType = workspaces[0]?.repo.type;
    if (!repoType) {
      throw new Error('[TaskEvaluationService] Cannot resolve grid slug: no workspace with a repo');
    }
    const gridSlug = ConnectorRegistry.REPO_TYPE_TO_GRID[repoType];
    if (!gridSlug) {
      throw new Error(`[TaskEvaluationService] No evaluation grid mapping for repo type: "${repoType}"`);
    }
    return gridSlug;
  }

  private createOrchestrator(workspaces: TaskWorkspaceInfo[]): ConnectorsOrchestrator {
    const repos = workspaces.map(w => w.repo);
    const connectors: ExternalConnector[] = [];

    for (const workspace of workspaces) {
      const connector = ConnectorRegistry.createConnector(workspace.repo, { branch: workspace.branch });
      if (!connector) {
        console.warn(`[TaskEvaluationService] No connector for repo ${workspace.repo.title} (type: ${workspace.repo.type})`);
        continue;
      }
      connectors.push(connector);
    }

    return new ConnectorsOrchestrator(connectors, repos);
  }

  private async upsertContribution(
    existing: Contribution | null,
    evaluation: Evaluation,
    challengeId: string,
    taskId: string,
    userId: string
  ): Promise<Contribution> {
    const evaluationData = {
      scores: evaluation.scores,
      globalScore: evaluation.globalScore,
    };

    if (existing) {
      console.log(`[TaskEvaluationService] 🔄 Mise à jour contribution ${existing.uuid}`);
      return this.contributionRepo.update(existing.uuid, {
        title: evaluation.contribution?.title || existing.title,
        type: evaluation.contribution?.type || existing.type,
        description: evaluation.contribution?.description || existing.description,
        evaluation: evaluationData,
        tags: evaluation.contribution?.tags || existing.tags,
        submitted_at: new Date(),
      });
    }

    console.log(`[TaskEvaluationService] ➕ Création nouvelle contribution`);
    return this.contributionRepo.create({
      title: evaluation.contribution?.title || "Task contribution",
      type: evaluation.contribution?.type || "code",
      description: evaluation.contribution?.description,
      evaluation: evaluationData,
      tags: evaluation.contribution?.tags,
      reward: 0,
      user_id: userId,
      challenge_id: challengeId,
      task_id: taskId,
      submitted_at: new Date(),
    });
  }
}
