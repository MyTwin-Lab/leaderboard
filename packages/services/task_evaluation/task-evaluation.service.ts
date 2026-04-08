import { OpenAIAgentEvaluator } from "../../evaluator/evaluator.js";
import { EvaluationGridRegistry } from "../../evaluator/grids/index.js";
import type { AgentEvaluator } from "../../evaluator/interfaces.js";
import type {
  Evaluation,
  EvaluateContext,
  SnapshotInfo,
  Contribution as EvalContribution,
} from "../../evaluator/types.js";
import type { Contribution } from "../../database-service/domain/entities.js";
import { ContributionRepository } from "../../database-service/repositories/index.js";
import { ConnectorRegistry } from "../../connectors/registry.js";
import { ConnectorsOrchestrator } from "../../connectors/connectors.orchestrator.js";
import type { ExternalConnector } from "../../connectors/interfaces.js";
import { SnapshotService } from "../evaluation/snapshot.service.js";
import { DatabaseGridProvider } from "../evaluation/database-grid-provider.js";
import { RunLogger } from "../evaluation/run-logger.js";
import { TaskContextService, type TaskEvaluationContext, type TaskWorkspaceInfo } from "./task-context.service.js";

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
 * Pipeline simplifié : context → connect branch → fetch commits → snapshot → evaluate → upsert contribution.
 * Pas de phase identify/merge car on connaît déjà l'utilisateur et la task.
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
   * Sinon, une nouvelle contribution est créée.
   */
  async evaluateTask(options: TaskEvaluationOptions): Promise<TaskEvaluationResult> {
    const { userId, taskId } = options;
    console.log(`\n🔄 [TaskEvaluationService] Évaluation de la task ${taskId} pour l'utilisateur ${userId}`);

    // 1. Récupérer le contexte de la task
    const taskContext = await this.contextService.getTaskContext(taskId, userId);
    const { challenge, task, workspaces } = taskContext;

    console.log(`   - Challenge: ${challenge.title}`);
    console.log(`   - Task: ${task.title}`);
    console.log(`   - Workspaces: ${workspaces.length}`);

    if (workspaces.length === 0) {
      throw new Error(`[TaskEvaluationService] No workspace found for task ${taskId}`);
    }

    // 2. Démarrer le run d'évaluation
    const now = new Date();
    const runId = await this.runLogger.startRun({
      challengeId: challenge.uuid,
      triggerType: 'manual',
      triggerPayload: { taskId, userId },
      windowStart: now,
      windowEnd: now,
      createdBy: userId,
    });

    // 3. Créer les connecteurs via le registre (agnostique du type)
    const orchestrator = this.createOrchestrator(workspaces);
    await orchestrator.connectAll();

    try {
      // 4. Récupérer les commits sur la branche via l'orchestrateur
      const allItems = await orchestrator.fetchAllItems({ maxCommits: 100 });
      const allCommitShas = allItems.map(item => item.id);

      console.log(`   - ${allCommitShas.length} total commits across ${workspaces.length} workspace(s)`);

      if (allCommitShas.length === 0) {
        throw new Error(`[TaskEvaluationService] No commits found on task branches for task ${taskId}`);
      }

      // 5. Construire le snapshot agrégé
      const resolveConnector = (commitSha: string) => orchestrator.getConnectorForItem(commitSha);
      const aggregatedSnapshot = await this.snapshotService.buildAggregatedSnapshot(
        resolveConnector,
        allCommitShas
      );

      if (!aggregatedSnapshot) {
        throw new Error(`[TaskEvaluationService] Unable to build snapshot for task ${taskId}`);
      }

      // 6. Préparer le snapshot (écriture fichiers temporaires)
      const preparedSnapshot = await this.snapshotService.prepareSnapshot(aggregatedSnapshot);

      // 7. Charger la grille d'évaluation en déduisant le type depuis le repo
      const gridSlug = this.resolveGridSlug(workspaces);
      const grid = await EvaluationGridRegistry.getGridAsync(gridSlug);

      // 8. Vérifier si une contribution existe déjà (upsert)
      const existingContribution = await this.contributionRepo.findByTaskAndUser(taskId, userId);
      const isUpdate = !!existingContribution;

      // 9. Construire la contribution pour l'évaluateur
      const evalContribution: EvalContribution = {
        title: task.title,
        type: gridSlug,
        description: task.description,
        challenge_id: challenge.uuid,
        userId,
        commitShas: allCommitShas,
      };

      // Si c'est une mise à jour, enrichir avec l'évaluation précédente
      if (isUpdate && existingContribution?.evaluation) {
        (evalContribution as any).evaluation = existingContribution.evaluation;
      }

      // 10. Évaluer
      console.log(`[TaskEvaluationService] 📊 Évaluation (${isUpdate ? 'mise à jour' : 'nouvelle'})...`);
      const evalContext: EvaluateContext = {
        snapshot: preparedSnapshot as SnapshotInfo,
        grid,
      };

      const evaluation = await this.evaluator.evaluate(isUpdate, evalContribution, evalContext);
      evaluation.contribution = evalContribution;

      // 11. Upsert la contribution en base
      const savedContribution = await this.upsertContribution(
        existingContribution,
        evaluation,
        challenge.uuid,
        taskId,
        userId
      );

      // 12. Logger la contribution dans le run
      await this.runLogger.logContributions(runId, [{
        contributionId: savedContribution.uuid,
        status: 'evaluated' as const,
      }]);

      // 13. Marquer le run comme réussi
      await this.runLogger.markSucceeded(runId, {
        contributionCount: 1,
        evaluatorVersion: '1.0.0',
      });

      console.log(`[TaskEvaluationService] ✅ Évaluation terminée (score: ${evaluation.globalScore}, ${isUpdate ? 'updated' : 'created'}, run: ${runId})`);

      return {
        evaluation,
        contribution: savedContribution,
        isUpdate,
      };
    } catch (error) {
      // Marquer le run comme échoué
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.runLogger.markFailed(runId, 'TASK_EVALUATION_ERROR', errorMessage);
      throw error;
    } finally {
      await orchestrator.disconnectAll();
    }
  }

  /**
   * Déduit le slug de grille d'évaluation depuis le type de repo des workspaces.
   * Utilise le premier workspace disponible.
   */
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

  /**
   * Crée un orchestrateur de connecteurs à partir des workspaces de la task.
   * Utilise le ConnectorRegistry pour instancier le bon connecteur selon le type de repo.
   */
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

  /**
   * Upsert : met à jour la contribution existante ou en crée une nouvelle
   */
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
      // Update
      console.log(`[TaskEvaluationService] 🔄 Mise à jour contribution ${existing.uuid}`);
      return this.contributionRepo.update(existing.uuid, {
        title: evaluation.contribution?.title || existing.title,
        type: evaluation.contribution?.type || existing.type,
        description: evaluation.contribution?.description || existing.description,
        evaluation: evaluationData,
        tags: evaluation.contribution?.tags || existing.tags,
        submitted_at: new Date(),
      });
    } else {
      // Create
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
}