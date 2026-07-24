import { OpenAIAgentEvaluator } from "../../evaluator/evaluator.js";
import { EvaluationGridRegistry } from "../../evaluator/grids/index.js";
import { computeMlAward, type MlAwardRule, type MlLineage } from "../../evaluator/ml-reward.js";
import type { EvaluateContext, SnapshotInfo } from "../../evaluator/types.js";
import {
  ChallengeRepository,
  ChallengeRepoRepository,
  ContributionRepository,
  RewardEntryRepository,
} from "../../database-service/repositories/index.js";
import type {
  Challenge,
  ChallengeRepoRole,
  Contribution,
} from "../../database-service/domain/entities.js";
import type { MlRewardRules } from "../../database-service/domain/mlRewardRules.js";
import { ConnectorRegistry } from "../../connectors/registry.js";
import type { KaggleRepoActivity } from "../../connectors/interfaces.js";
import { SnapshotService } from "./snapshot.service.js";
import { DatabaseGridProvider } from "../database-grid-provider.js";
import { extractArtifactRef } from "./artifactUrl.js";
import { resolveLineage } from "./lineage.js";

/** Rôle → règle de reward et grille d'évaluation. */
const ROLE_RULE: Record<ChallengeRepoRole, {
  rule: MlAwardRule;
  contributionType: string;
  /** Slug de grille, ou null quand la règle ne passe pas par l'agent. */
  grid: string | null;
}> = {
  dataset:    { rule: 'dataset',       contributionType: 'dataset',       grid: 'dataset' },
  // Le modèle Kaggle n'est pas noté par un agent : sa moitié de reward est
  // pilotée par la métrique lue dans la model card.
  model:      { rule: 'model_metric',  contributionType: 'model',         grid: null      },
  model_code: { rule: 'model_code',    contributionType: 'model',         grid: 'code'    },
  api:        { rule: 'api_packaging', contributionType: 'api_packaging', grid: 'code'    },
};

export interface MlSubmissionEvent {
  challengeId: string;
  userId: string;
  repoId: string;
  url: string;
}

/**
 * Dépendances du service, injectables pour les tests.
 *
 * Les repositories sont pris par leur surface utilisée plutôt qu'en entier :
 * un fake de test n'a pas à implémenter des méthodes que le service n'appelle
 * jamais. `readMetric` et `runAgent` isolent les deux seuls accès réseau
 * (Kaggle, OpenAI), ce qui rend le flux d'attribution testable de bout en bout.
 */
export interface MlRewardsDeps {
  challengeRepo: Pick<ChallengeRepository, 'findById'>;
  challengeRepoRepo: Pick<ChallengeRepoRepository, 'findByChallengeAndRepo'>;
  contributionRepo: Pick<ContributionRepository, 'findByChallenge' | 'update'>;
  rewardRepo: Pick<RewardEntryRepository, 'sumByChallenge' | 'bestMetricValue' | 'createManyAndSyncRewards'>;
  readMetric: (url: string, rules: MlRewardRules) => Promise<number>;
  runAgent: (input: {
    role: ChallengeRepoRole;
    url: string;
    contribution: Contribution;
    challenge: Challenge;
    gridSlug: string;
  }) => Promise<number>;
}

/**
 * MlRewardsService
 * ----------------
 * Attribution live des points sur les challenges ML.
 *
 * Séparé de RewardsService (challenges code) : là-bas un pool est distribué
 * proportionnellement au close, ici chaque soumission produit immédiatement des
 * lignes de ledger immuables. Rien n'est recalculé.
 */
export class MlRewardsService {
  private deps: MlRewardsDeps;
  private snapshotService = new SnapshotService();
  private evaluator = new OpenAIAgentEvaluator();
  private static dbProviderInitialized = false;

  constructor(deps?: Partial<MlRewardsDeps>) {
    if (!MlRewardsService.dbProviderInitialized) {
      EvaluationGridRegistry.setDatabaseProvider(new DatabaseGridProvider());
      MlRewardsService.dbProviderInitialized = true;
    }

    this.deps = {
      challengeRepo: new ChallengeRepository(),
      challengeRepoRepo: new ChallengeRepoRepository(),
      contributionRepo: new ContributionRepository(),
      rewardRepo: new RewardEntryRepository(),
      readMetric: (url, rules) => this.readKaggleMetric(url, rules),
      runAgent: (input) => this.runAgentDefault(input),
      ...deps,
    };
  }

  /**
   * Lance l'attribution en tâche de fond.
   *
   * L'appelant (le PATCH) ne peut pas attendre : un appel agent dure des
   * dizaines de secondes et ferait expirer la requête. Le statut vit sur
   * `contributions.evaluation_status`, que l'UI interroge.
   */
  scheduleAward(event: MlSubmissionEvent): void {
    this.award(event).catch((error) => {
      console.error(`[MlRewardsService] Award failed for ${event.userId} on ${event.repoId}:`, error);
    });
  }

  /** Attribue les points d'une soumission. Idempotent par ligne, jamais par contribution. */
  async award(event: MlSubmissionEvent): Promise<void> {
    const { challengeId, userId, repoId, url } = event;

    const challenge = await this.deps.challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== 'ml') return;

    const rules = challenge.reward_rules;
    if (!rules) {
      console.warn(`[MlRewardsService] Challenge ${challengeId} has no reward rules — skipping award`);
      return;
    }

    const challengeRepo = await this.deps.challengeRepoRepo.findByChallengeAndRepo(challengeId, repoId);
    if (!challengeRepo?.role) return;

    const config = ROLE_RULE[challengeRepo.role];
    const contribution = await this.findContribution(challengeId, userId, config.contributionType);
    if (!contribution) {
      console.warn(`[MlRewardsService] No ${config.contributionType} contribution for user ${userId}`);
      return;
    }

    const lineage = await this.resolveLineage(challenge, userId);

    // Réutiliser le dataset d'un autre ne rapporte rien à l'étape 1 : rien n'a
    // été produit. Inutile de payer un appel agent pour re-noter le même
    // artefact — le résultat serait identique à celui de l'auteur.
    if (challengeRepo.role === 'dataset' && lineage.datasetAuthorId && lineage.datasetAuthorId !== userId) {
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: 'skipped_reuse' });
      console.log(`[MlRewardsService] Dataset reused from ${lineage.datasetAuthorId} — no agent, no points`);
      return;
    }

    await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: 'running' });

    try {
      const measured = config.grid
        ? {
            agentScore: await this.deps.runAgent({
              role: challengeRepo.role,
              url,
              contribution,
              challenge,
              gridSlug: config.grid,
            }),
          }
        : { metricValue: await this.deps.readMetric(url, rules) };

      const [remainingPool, bestOtherMetricValue, myBestMetricValue] = await Promise.all([
        this.remainingPool(challenge),
        this.deps.rewardRepo.bestMetricValue(challengeId, { excludeUserId: userId }),
        this.deps.rewardRepo.bestMetricValue(challengeId, { onlyUserId: userId }),
      ]);

      const drafts = computeMlAward({
        rule: config.rule,
        rules,
        challengeId,
        userId,
        contributionId: contribution.uuid,
        remainingPool,
        bestOtherMetricValue,
        myBestMetricValue,
        lineage,
        ...measured,
      });

      await this.deps.rewardRepo.createManyAndSyncRewards(drafts);
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: 'done' });

      const net = drafts.filter(d => d.user_id === userId).reduce((s, d) => s + d.points, 0);
      console.log(`[MlRewardsService] ${config.rule}: ${net} CP net to ${userId} (${drafts.length} ledger rows)`);
    } catch (error) {
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: 'failed' });
      throw error;
    }
  }

  /**
   * CP encore à prendre sur le challenge. Les récompenses de signaux Slack
   * sont hors pool (montant fixe par signal), donc exclues du décompte.
   */
  async remainingPool(challenge: Challenge): Promise<number> {
    const distributed = await this.deps.rewardRepo.sumByChallenge(challenge.uuid, {
      excludeRuleKeys: ['slack_signal'],
    });
    return Math.max(0, challenge.contribution_points_reward - distributed);
  }

  private async findContribution(
    challengeId: string,
    userId: string,
    type: string
  ): Promise<Contribution | undefined> {
    const all = await this.deps.contributionRepo.findByChallenge(challengeId);
    return all.find(c => c.user_id === userId && c.type === type);
  }

  /**
   * Lit la métrique depuis la model card Kaggle.
   *
   * L'extraction passe par `parseMetrics` du connecteur, qui est déterministe
   * et testée. Confier ce nombre à l'agent le rendrait non reproductible et
   * inauditable, pour un résultat au mieux équivalent.
   */
  private async readKaggleMetric(url: string, rules: MlRewardRules): Promise<number> {
    const ref = extractArtifactRef(url);
    if (!ref) throw new Error(`[MlRewardsService] Cannot extract Kaggle ref from "${url}"`);

    const connector = await ConnectorRegistry.createConnector({
      uuid: '', title: ref, type: 'kaggle_model', external_repo_id: ref, project_id: '',
    });
    if (!connector) throw new Error('[MlRewardsService] Kaggle connector unavailable (missing credentials?)');

    if (!connector.fetchRepoActivity) {
      throw new Error('[MlRewardsService] Kaggle connector cannot report model metrics');
    }

    await connector.connect();
    try {
      const activity = await connector.fetchRepoActivity() as KaggleRepoActivity;
      const versions = activity.modelVersions?.flatMap(m => m.versions) ?? [];
      const metricName = rules.model.metric.name;

      // La dernière version qui publie la métrique fait foi.
      const values = versions
        .map(v => v.metrics?.[metricName])
        .filter((n): n is number => typeof n === 'number' && isFinite(n));

      if (values.length === 0) {
        console.warn(`[MlRewardsService] No "${metricName}" found in the model card for ${ref}`);
        return 0;
      }
      return values[values.length - 1];
    } finally {
      await connector.disconnect?.();
    }
  }

  /** Fait tourner l'agent sur l'artefact soumis et renvoie une note 0..1. */
  private async runAgentDefault({ role, url, contribution, challenge, gridSlug }: {
    role: ChallengeRepoRole;
    url: string;
    contribution: Contribution;
    challenge: Challenge;
    gridSlug: string;
  }): Promise<number> {
    const ref = extractArtifactRef(url);
    if (!ref) throw new Error(`[MlRewardsService] Cannot extract ref from "${url}"`);

    const repoType = role === 'dataset' ? 'kaggle_dataset' : 'github';
    const connector = await ConnectorRegistry.createConnector({
      uuid: '', title: ref, type: repoType, external_repo_id: ref, project_id: '',
    });
    if (!connector) throw new Error(`[MlRewardsService] No connector for ${repoType}`);

    await connector.connect();
    try {
      const items = await connector.fetchItems();
      if (items.length === 0) throw new Error(`[MlRewardsService] Nothing to evaluate at ${ref}`);

      const content = await connector.fetchItemContent(items[0].id);
      const prepared = await this.snapshotService.prepareSnapshot({
        commitSha: content.commitSha,
        modifiedFiles: content.modifiedFiles,
      } as SnapshotInfo);

      const grid = await EvaluationGridRegistry.getGridAsync(gridSlug);
      const evalContext: EvaluateContext = { snapshot: prepared, grid };

      const evaluation = await this.evaluator.evaluate(false, {
        title: contribution.title,
        type: gridSlug,
        description: contribution.description,
        challenge_id: challenge.uuid,
        userId: contribution.user_id,
        commitShas: [content.commitSha],
      }, evalContext);

      await this.deps.contributionRepo.update(contribution.uuid, { evaluation });

      // globalScore est sur 0–100, les caps se raisonnent en fraction.
      return Math.min(1, Math.max(0, evaluation.globalScore / 100));
    } finally {
      await connector.disconnect?.();
    }
  }

  private async resolveLineage(challenge: Challenge, userId: string): Promise<MlLineage> {
    const all = await this.deps.contributionRepo.findByChallenge(challenge.uuid);
    return resolveLineage(all, userId);
  }
}
