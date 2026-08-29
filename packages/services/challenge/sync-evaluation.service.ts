import { OpenAIAgentEvaluator } from "../../evaluator/evaluator.js";
import { EvaluationGridRegistry } from "../../evaluator/grids/index.js";
import type { 
  Evaluation, 
  IdentifyContext, 
  OldContribution, 
  EvaluateContext,
  SnapshotInfo 
} from "../../evaluator/types.js";
import type { User, Contribution } from "../../database-service/domain/entities.js";
import { ContributionRepository } from "../../database-service/repositories/index.js";
import { ChallengeContextService, ChallengeContext, SyncData, ConnectorsContext } from "./challenge-context.service.js";
import { SnapshotService } from "./snapshot.service.js";
import { DatabaseGridProvider } from "../database-grid-provider.js";

export interface SyncEvaluationResult {
  evaluations: Evaluation[];
  contributionsIdentified: number;
  contributionsMerged: number;
  contributionsEvaluated: number;
}

/**
 * SyncEvaluationService
 * ---------------------
 * Gère le pipeline d'évaluation sync : identify → merge → evaluate.
 * Utilise les agents IA pour identifier et scorer les contributions.
 */
export class SyncEvaluationService {
  private evaluator: OpenAIAgentEvaluator;
  private contributionRepo: ContributionRepository;
  private snapshotService: SnapshotService;
  private static dbProviderInitialized = false;

  constructor() {
    this.evaluator = new OpenAIAgentEvaluator();
    this.contributionRepo = new ContributionRepository();
    this.snapshotService = new SnapshotService();
    
    // Initialiser le DatabaseGridProvider une seule fois
    if (!SyncEvaluationService.dbProviderInitialized) {
      EvaluationGridRegistry.setDatabaseProvider(new DatabaseGridProvider());
      SyncEvaluationService.dbProviderInitialized = true;
      console.log("[SyncEvaluationService] DatabaseGridProvider initialized");
    }
  }

  /**
   * Exécute le pipeline d'évaluation complet
   */
  async runEvaluation(
    challengeContext: ChallengeContext,
    syncData: SyncData,
    connectorsCtx: ConnectorsContext
  ): Promise<SyncEvaluationResult> {
    const { challenge, teamMembers, tasks } = challengeContext;

    // 1. Préparer le contexte pour l'agent Identify
    const identifyContext: IdentifyContext = {
      syncPreview: syncData.syncPreview,
      commits: syncData.commits.map(c => ({ ...c })),
      users: teamMembers.map((u: User) => ({
        uuid: u.uuid,
        full_name: u.full_name,
        github_username: u.github_username
      })),
      roadmap: challenge.roadmap,
      tasks: tasks.map(t => ({
        uuid: t.uuid,
        title: t.title,
        description: t.description,
        status: t.status
      }))
    };

    // 2. Identifier les contributions
    console.log("[SyncEvaluationService] 🔍 Identification des contributions...");
    const identifiedContributions = await this.evaluator.identify(identifyContext);
    console.log(`[SyncEvaluationService] ✅ ${identifiedContributions.length} contributions identifiées`);

    // 3. Récupérer les anciennes contributions pour le merge
    const oldContributions = await this.contributionRepo.findByChallenge(challenge.uuid);
    const sanitizedOldContributions: OldContribution[] = oldContributions.map(({
      challenge_id: _challengeId,
      evaluation: _evaluation,
      reward: _reward,
      ...rest
    }) => ({
      ...rest
    }));

    // 4. Merger les contributions
    console.log("[SyncEvaluationService] 🔀 Fusion des contributions...");
    const mergedContributions = await this.evaluator.merge(identifiedContributions, sanitizedOldContributions);
    console.log(`[SyncEvaluationService] ✅ ${mergedContributions.length} contributions fusionnées`);

    // 5. Enrichir avec les évaluations précédentes si existantes
    const oldContributionById = new Map(
      oldContributions.map(c => [c.uuid, c])
    );

    const mergedContributionsWithGrid = mergedContributions.map(mergedContribution => {
      const matchingOld = oldContributionById.get(mergedContribution.oldContributionId);
      if (!matchingOld?.evaluation) {
        return mergedContribution;
      }
      return {
        ...mergedContribution,
        contribution: {
          ...mergedContribution.contribution,
          evaluation: matchingOld.evaluation,
        },
      };
    });

    // 6. Évaluer chaque contribution
    console.log("[SyncEvaluationService] 📊 Évaluation des contributions...");
    const resolveConnector = (commitSha: string) => connectorsCtx.orchestrator.getConnectorForItem(commitSha);
    const evaluations: Evaluation[] = [];

    for (const item of mergedContributionsWithGrid) {
      const contribution = item.contribution;
      const commitShas = contribution.commitShas ?? [];
      
      if (commitShas.length === 0) {
        console.warn(`[SyncEvaluationService] Contribution ${contribution.title} has no commitShas, skipping`);
        continue;
      }

      const aggregatedSnapshot = await this.snapshotService.buildAggregatedSnapshot(resolveConnector, commitShas);
      if (!aggregatedSnapshot) {
        console.warn(`[SyncEvaluationService] Unable to build snapshot for ${contribution.title}`);
        continue;
      }

      const grid = await EvaluationGridRegistry.getGridAsync(contribution.type);
      const preparedSnapshot = await this.snapshotService.prepareSnapshot(aggregatedSnapshot);
      const isUpdate = 'evaluation' in contribution && !!contribution.evaluation;

      try {
        const evalContext: EvaluateContext = {
          snapshot: preparedSnapshot as SnapshotInfo,
          grid
        };

        const evaluation = await this.evaluator.evaluate(isUpdate, item, evalContext);
        evaluation.contribution = contribution;
        evaluations.push(evaluation);
      } catch (error) {
        console.error(`[SyncEvaluationService] Error evaluating ${contribution.title}:`, error);
      }
    }

    console.log(`[SyncEvaluationService] ✅ ${evaluations.length} évaluations effectuées`);

    return {
      evaluations,
      contributionsIdentified: identifiedContributions.length,
      contributionsMerged: mergedContributions.length,
      contributionsEvaluated: evaluations.length,
    };
  }

  /**
   * Sauvegarde les évaluations en base de données
   */
  async saveEvaluations(challengeId: string, evaluations: Evaluation[]): Promise<Contribution[]> {
    const savedContributions: Contribution[] = [];

    for (const evaluation of evaluations) {
      if (!evaluation.contribution) continue;

      const contrib = evaluation.contribution;

      try {
        const saved = await this.contributionRepo.create({
          title: contrib.title,
          type: contrib.type,
          description: contrib.description,
          evaluation: {
            scores: evaluation.scores,
            globalScore: evaluation.globalScore
          },
          tags: contrib.tags,
          reward: 0,
          user_id: contrib.userId,
          challenge_id: challengeId,
          submitted_at: new Date(),
        });
        savedContributions.push(saved);
      } catch (error) {
        console.error(`[SyncEvaluationService] Error saving ${contrib.title}:`, error);
      }
    }

    console.log(`[SyncEvaluationService] 💾 ${savedContributions.length} contributions sauvegardées`);
    return savedContributions;
  }
}
