import { 
  EvaluationRunsRepository, 
  EvaluationRunContributionsRepository 
} from "../database-service/repositories/index.js";
import type { 
  EvaluationRun, 
  EvaluationRunTriggerType, 
  EvaluationRunStatus,
  EvaluationRunMeta,
  EvaluationRunContribution,
  EvaluationRunContributionStatus,
} from "../database-service/domain/entities.js";

export interface StartRunContext {
  challengeId: string;
  triggerType: EvaluationRunTriggerType;
  triggerPayload?: Record<string, unknown>;
  windowStart: Date;
  windowEnd: Date;
  createdBy?: string;
  retryOfRunId?: string;
}

export interface LogContributionInput {
  contributionId: string;
  status: EvaluationRunContributionStatus;
  notes?: EvaluationRunContribution['notes'];
}

/**
 * RunLogger
 * ---------
 * Service pour instrumenter et tracer les runs d'évaluation.
 * Permet de créer un run, logger les contributions traitées,
 * et marquer le run comme réussi ou échoué.
 */
export class RunLogger {
  private runsRepo: EvaluationRunsRepository;
  private runContributionsRepo: EvaluationRunContributionsRepository;

  constructor() {
    this.runsRepo = new EvaluationRunsRepository();
    this.runContributionsRepo = new EvaluationRunContributionsRepository();
  }

  /**
   * Démarre un nouveau run d'évaluation
   * @returns L'ID du run créé
   */
  async startRun(ctx: StartRunContext): Promise<string> {
    const run = await this.runsRepo.create({
      challenge_id: ctx.challengeId,
      trigger_type: ctx.triggerType,
      trigger_payload: ctx.triggerPayload,
      window_start: ctx.windowStart,
      window_end: ctx.windowEnd,
      status: 'running',
      started_at: new Date(),
      created_by: ctx.createdBy,
      retry_of_run_id: ctx.retryOfRunId,
    });

    console.log(`[RunLogger] ▶️ Run démarré: ${run.uuid} (challenge: ${ctx.challengeId}, trigger: ${ctx.triggerType})`);
    return run.uuid;
  }

  /**
   * Enregistre les contributions identifiées pour un run
   */
  async logContributions(runId: string, contributions: LogContributionInput[]): Promise<void> {
    if (contributions.length === 0) {
      console.log(`[RunLogger] Aucune contribution à logger pour le run ${runId}`);
      return;
    }

    const entities = contributions.map(c => ({
      run_id: runId,
      contribution_id: c.contributionId,
      status: c.status,
      notes: c.notes,
    }));

    await this.runContributionsRepo.bulkInsert(entities);
    console.log(`[RunLogger] 📝 ${contributions.length} contributions loggées pour le run ${runId}`);
  }

  /**
   * Met à jour le statut d'une contribution dans un run
   */
  async updateContributionStatus(
    runContributionId: string, 
    status: EvaluationRunContributionStatus,
    notes?: EvaluationRunContribution['notes']
  ): Promise<void> {
    await this.runContributionsRepo.updateStatus(runContributionId, status, notes);
  }

  /**
   * Marque le run comme réussi
   */
  async markSucceeded(runId: string, meta?: EvaluationRunMeta): Promise<void> {
    const contributionCount = await this.runContributionsRepo.countByRun(runId);
    const run = await this.runsRepo.findById(runId);
    
    const durationMs = run?.started_at 
      ? Date.now() - run.started_at.getTime() 
      : undefined;

    const finalMeta: EvaluationRunMeta = {
      ...meta,
      contributionCount,
      durationMs,
    };

    await this.runsRepo.markSucceeded(runId, finalMeta);
    console.log(`[RunLogger] ✅ Run ${runId} terminé avec succès (${contributionCount} contributions, ${durationMs}ms)`);
  }

  /**
   * Marque le run comme échoué
   */
  async markFailed(runId: string, errorCode: string, errorMessage: string): Promise<void> {
    await this.runsRepo.markFailed(runId, errorCode, errorMessage);
    console.log(`[RunLogger] ❌ Run ${runId} échoué: [${errorCode}] ${errorMessage.slice(0, 100)}`);
  }

  /**
   * Annule un run en cours
   */
  async cancelRun(runId: string): Promise<void> {
    await this.runsRepo.update(runId, {
      status: 'canceled',
      finished_at: new Date(),
    });
    console.log(`[RunLogger] 🚫 Run ${runId} annulé`);
  }

  /**
   * Met à jour la fenêtre temporelle d'un run
   */
  async updateTimeWindow(runId: string, windowStart: Date, windowEnd: Date): Promise<void> {
    await this.runsRepo.update(runId, {
      window_start: windowStart,
      window_end: windowEnd,
    });
    console.log(`[RunLogger] 🕐 Fenêtre temporelle mise à jour pour le run ${runId}`);
  }

  /**
   * Récupère un run par son ID
   */
  async getRun(runId: string): Promise<EvaluationRun | null> {
    return this.runsRepo.findById(runId);
  }

  /**
   * Récupère les statistiques d'un run
   */
  async getRunStats(runId: string) {
    const run = await this.runsRepo.findById(runId);
    if (!run) return null;

    const contributionCounts = await this.runContributionsRepo.countByStatus(runId);
    
    return {
      run,
      contributions: contributionCounts,
      totalContributions: Object.values(contributionCounts).reduce((a, b) => a + b, 0),
    };
  }
}
