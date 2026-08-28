import type { Evaluation } from "../../evaluator/types.js";
import { ChallengeContextService } from "./challenge-context.service.js";
import { SyncEvaluationService } from "./sync-evaluation.service.js";
import { RunLogger } from "../run-logger.js";
import type { EvaluationRunTriggerType } from "../../database-service/domain/entities.js";

export interface RunSyncOptions {
  createdBy?: string;
  retryOfRunId?: string;
  triggerType?: EvaluationRunTriggerType;
  windowStart?: Date;
  windowEnd?: Date;
  retryReason?: string;
}

/**
 * ChallengeService
 * ----------------
 * Façade principale pour gérer le cycle de vie complet d'un challenge.
 * Délègue aux services spécialisés pour chaque responsabilité.
 */
export class ChallengeService {
  private contextService: ChallengeContextService;
  private syncEvaluationService: SyncEvaluationService;
  private runLogger: RunLogger;

  constructor() {
    this.contextService = new ChallengeContextService();
    this.syncEvaluationService = new SyncEvaluationService();
    this.runLogger = new RunLogger();
  }

  /**
   * Récupère les informations d'un challenge avec ses repos et son équipe
   */
  async getChallengeContext(challengeId: string) {
    return this.contextService.getChallengeContext(challengeId);
  }

  /**
   * Sync Meeting - Identifier et scorer les contributions
   * 
   * @param challengeId - ID du challenge actif
   * @returns Liste des évaluations effectuées
   */
  async runSyncEvaluation(challengeId: string, options?: RunSyncOptions): Promise<Evaluation[]> {
    console.log(`\n🔄 [ChallengeService] Sync Evaluation pour challenge ${challengeId}`);

    // 1. Récupérer le contexte du challenge
    const challengeContext = await this.contextService.getChallengeContext(challengeId);
    console.log(`   - Challenge: ${challengeContext.challenge.title}`);
    console.log(`   - Repos: ${challengeContext.repos.length}`);
    console.log(`   - Team: ${challengeContext.teamMembers.length} membres`);
    console.log(`   - Tasks: ${challengeContext.tasks.length}`);

    // 2. Déterminer la fenêtre temporelle initiale (valeurs par défaut)
    const defaultWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const defaultWindowEnd = new Date();
    const windowStart = options?.windowStart ?? defaultWindowStart;
    const windowEnd = options?.windowEnd ?? defaultWindowEnd;

    // 3. Construire le trigger_payload pour journaliser les relances
    const triggerPayload: Record<string, unknown> = {};
    if (options?.retryOfRunId) {
      triggerPayload.retryOfRunId = options.retryOfRunId;
      triggerPayload.retryReason = options.retryReason;
      triggerPayload.retriedAt = new Date().toISOString();
      triggerPayload.retriedBy = options.createdBy;
      console.log(`[ChallengeService] 🔁 Relance du run ${options.retryOfRunId} - Raison: ${options.retryReason || 'Non spécifiée'}`);
    }

    // 4. Démarrer le run d'évaluation dès maintenant pour tracer tout le processus
    const runId = await this.runLogger.startRun({
      challengeId,
      triggerType: options?.triggerType ?? 'sync',
      triggerPayload: Object.keys(triggerPayload).length > 0 ? triggerPayload : undefined,
      windowStart,
      windowEnd,
      createdBy: options?.createdBy,
      retryOfRunId: options?.retryOfRunId,
    });

    let connectorsCtx;
    try {
      // 5. Initialiser les connecteurs
      connectorsCtx = await this.contextService.initializeConnectors(challengeContext.repos);

      // 6. Récupérer les données de synchronisation (pour avoir la fenêtre temporelle réelle)
      const syncData = await this.contextService.fetchSyncData(
        challengeContext.challenge,
        connectorsCtx
      );

      // 7. Mettre à jour la fenêtre temporelle si syncData fournit des valeurs plus précises
      const finalWindowStart = options?.windowStart ?? syncData.windowStart ?? windowStart;
      const finalWindowEnd = options?.windowEnd ?? syncData.windowEnd ?? windowEnd;
      
      if (finalWindowStart.getTime() !== windowStart.getTime() || finalWindowEnd.getTime() !== windowEnd.getTime()) {
        await this.runLogger.updateTimeWindow(runId, finalWindowStart, finalWindowEnd);
      }

      // 8. Exécuter le pipeline d'évaluation (identify → merge → evaluate)
      const result = await this.syncEvaluationService.runEvaluation(
        challengeContext,
        syncData,
        connectorsCtx
      );

      // 9. Sauvegarder les évaluations et logger les contributions
      const savedContributions = await this.syncEvaluationService.saveEvaluations(challengeId, result.evaluations);

      // 10. Logger les contributions dans le run
      await this.runLogger.logContributions(
        runId,
        savedContributions.map(c => ({
          contributionId: c.uuid,
          status: 'evaluated' as const,
        }))
      );

      // 11. Marquer le run comme réussi
      await this.runLogger.markSucceeded(runId, {
        contributionCount: savedContributions.length,
        evaluatorVersion: '1.0.0',
      });

      console.log(`[ChallengeService] ✅ Sync terminé: ${result.contributionsEvaluated} évaluations (run: ${runId})`);

      return result.evaluations;
    } catch (error) {
      // Marquer le run comme échoué
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.runLogger.markFailed(runId, 'SYNC_EVALUATION_ERROR', errorMessage);
      throw error;
    } finally {
      // Déconnecter les connecteurs si ils ont été initialisés
      if (connectorsCtx) {
        try {
          await this.contextService.disconnectAll(connectorsCtx);
        } catch (disconnectError) {
          console.warn('[ChallengeService] Erreur lors de la déconnexion des connecteurs:', disconnectError);
        }
      }
    }
  }
}
