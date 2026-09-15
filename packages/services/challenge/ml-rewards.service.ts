import { evaluate } from "../../capabilities/evaluation.js";
import { computeMlAward, type MlLineage } from "../../../content/flows/ml/reward.js";
import {
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  ContributionMemberRepository,
  ContributionRepository,
  RewardEntryRepository,
} from "../../database-service/repositories/index.js";
import { splitShares } from "../../database-service/domain/share.js";
import { getGroupContext, type GroupContext } from "../../capabilities/groups.js";
import { distributedFromPool, poolCompletion, remainingPool } from "../../capabilities/pool.js";
import type {
  Challenge,
  ChallengeRepoRole,
  Contribution,
} from "../../database-service/domain/entities.js";
import { parseMlRewardRules, type MlRewardRules } from "../../database-service/domain/mlRewardRules.js";
import { ConnectorRegistry } from "../../connectors/registry.js";
import type { KaggleRepoActivity } from "../../connectors/interfaces.js";
import {
  MODEL_METRIC_META_FIELD,
  MODEL_METRIC_RULE_KEY,
  ML_SUBMISSION_EVALUATION_HANDLER,
  mlFlowDescriptor,
} from "../../../content/flows/ml/index.js";
import { KAGGLE_ARTIFACT_SOURCE, type KaggleArtifactInput } from "../../../content/bundle-sources/kaggle-artifact/index.js";
import { extractArtifactRef, normalizeArtifactUrl } from "./artifactUrl.js";
import { resolveLineage } from "./lineage.js";
import { ML_ROLE_RULE } from "./mlRoles.js";

// La table des rôles vit dans `mlRoles.ts` : la promotion d'un sandbox la lit
// sans avoir à charger l'évaluateur et les connecteurs importés ici.
export { ML_ROLE_RULE } from "./mlRoles.js";

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
  challengeRepo: Pick<ChallengeRepository, 'findById' | 'update'>;
  challengeRepoRepo: Pick<ChallengeRepoRepository, 'findByChallengeAndRepo' | 'findByChallengeAndRole'>;
  contributionRepo: Pick<ContributionRepository, 'findByChallenge' | 'update'>;
  rewardRepo: Pick<RewardEntryRepository, 'sumByChallenge' | 'maxMetaNumber' | 'createManyAndSyncRewards'>;
  contributionMemberRepo: Pick<ContributionMemberRepository, 'addShares'>;
  /** Lue par getGroupContext pour résoudre le porteur du workspace. */
  challengeTeamRepo: Pick<ChallengeTeamRepository, 'findByChallenge'>;
  readMetric: (url: string, rules: MlRewardRules) => Promise<number>;
  runAgent: (input: {
    role: ChallengeRepoRole;
    url: string;
    contribution: Contribution;
    challenge: Challenge;
    gridSlug: string;
    /** La soumission d'origine : ce que le rejeu du run rappellera. */
    submission: MlSubmissionEvent;
  }) => Promise<number>;
}

/**
 * MlRewardsService
 * ----------------
 * Attribution live des points sur les challenges ML.
 *
 * Chaque soumission produit immédiatement des lignes de ledger immuables,
 * clampées au reliquat du pool. Rien n'est recalculé.
 */
export class MlRewardsService {
  private deps: MlRewardsDeps;

  constructor(deps?: Partial<MlRewardsDeps>) {
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      challengeRepoRepo: new ChallengeRepoRepository(),
      contributionRepo: new ContributionRepository(),
      rewardRepo: new RewardEntryRepository(),
      contributionMemberRepo: new ContributionMemberRepository(),
      challengeTeamRepo: new ChallengeTeamRepository(),
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

    const rules = parseMlRewardRules(challenge.reward_rules);
    if (!rules) {
      console.warn(`[MlRewardsService] Challenge ${challengeId} has no reward rules — skipping award`);
      return;
    }

    const challengeRepo = await this.deps.challengeRepoRepo.findByChallengeAndRepo(challengeId, repoId);
    if (!challengeRepo?.role) return;

    // Un groupe partage sa vue de progression : la soumission d'un membre
    // alimente la contribution du porteur, pas une contribution par membre.
    const group = await this.loadGroup(challengeId, userId);
    const { ownerId } = group;

    const config = ML_ROLE_RULE[challengeRepo.role];
    const contribution = await this.findContribution(challengeId, ownerId, config.contributionType);
    if (!contribution) {
      console.warn(`[MlRewardsService] No ${config.contributionType} contribution for user ${ownerId}`);
      return;
    }

    const lineage = await this.resolveLineage(challenge, ownerId);

    // Réutiliser le dataset d'un autre ne rapporte rien à l'étape 1 : rien n'a
    // été produit. Inutile de payer un appel agent pour re-noter le même
    // artefact — le résultat serait identique à celui de l'auteur.
    if (challengeRepo.role === 'dataset' && lineage.datasetAuthorId && lineage.datasetAuthorId !== ownerId) {
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
              submission: event,
            }),
          }
        : { metricValue: await this.deps.readMetric(url, rules) };

      const metric = { ruleKey: MODEL_METRIC_RULE_KEY, field: MODEL_METRIC_META_FIELD };
      const [remaining, bestOtherMetricValue, myBestMetricValue] = await Promise.all([
        this.remainingPool(challenge),
        this.deps.rewardRepo.maxMetaNumber(challengeId, { ...metric, excludeUserId: ownerId }),
        this.deps.rewardRepo.maxMetaNumber(challengeId, { ...metric, onlyUserId: ownerId }),
      ]);

      const drafts = computeMlAward({
        rule: config.rule,
        rules,
        challengeId,
        userId: ownerId,
        contributionId: contribution.uuid,
        remainingPool: remaining,
        bestOtherMetricValue,
        myBestMetricValue,
        lineage,
        groupMultiplier: group.multiplier,
        ...measured,
      });

      await this.deps.rewardRepo.createManyAndSyncRewards(drafts);
      await this.recordGroupShares(group, contribution.uuid, drafts);
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: 'done' });

      const completion = poolCompletion(
        challenge.contribution_points_reward,
        await distributedFromPool(this.deps.rewardRepo, challenge.uuid)
      );
      await this.deps.challengeRepo.update(challenge.uuid, { completion });

      const net = drafts.filter(d => d.user_id === ownerId).reduce((s, d) => s + d.points, 0);
      const who = group.groupId ? `group ${group.groupId} (${group.memberIds.length})` : ownerId;
      console.log(`[MlRewardsService] ${config.rule}: ${net} CP net to ${who} (${drafts.length} ledger rows)`);
    } catch (error) {
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: 'failed' });
      throw error;
    }
  }

  /**
   * Le groupe de travail de l'appelant sur ce challenge.
   *
   * Passe par le repo injecté plutôt que d'appeler `getGroupContext` avec ses
   * dépendances par défaut : celles-ci ouvriraient une connexion, ce que les
   * tests de ce service n'ont pas à subir.
   */
  private loadGroup(challengeId: string, userId: string): Promise<GroupContext> {
    return getGroupContext(challengeId, userId, { challengeTeamRepo: this.deps.challengeTeamRepo });
  }

  /**
   * Répartit entre les membres le delta de CP revenant au groupe.
   *
   * Seules les lignes du porteur comptent : `computeMlAward` en produit aussi
   * pour des tiers (crédits de réutilisation, avec `source_user_id`), et ces
   * points-là appartiennent à l'auteur amont, pas au groupe.
   */
  private async recordGroupShares(
    group: GroupContext,
    contributionId: string,
    drafts: Array<{ user_id: string; points: number }>
  ): Promise<void> {
    if (group.memberIds.length <= 1) return;

    const delta = drafts
      .filter(d => d.user_id === group.ownerId)
      .reduce((sum, d) => sum + d.points, 0);
    if (delta === 0) return;

    const shares = splitShares(delta, group.memberIds, group.ownerId);
    await this.deps.contributionMemberRepo.addShares(
      [...shares].map(([user_id, share_cp]) => ({ contribution_id: contributionId, user_id, share_cp }))
    );
  }

  /**
   * CP encore à prendre sur le challenge : le pool moins ce qu'en ont pris les
   * clés qui le consomment (les récompenses fixes hors pool n'en font pas partie).
   */
  async remainingPool(challenge: Challenge): Promise<number> {
    return remainingPool(
      challenge.contribution_points_reward,
      await distributedFromPool(this.deps.rewardRepo, challenge.uuid)
    );
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

  /**
   * Fait noter l'artefact soumis par la capacité `evaluate` (source
   * `kaggle-artifact`) et renvoie une note 0..1. Le run est tracé au nom du
   * flow ML, rejouable à partir de la soumission.
   */
  private async runAgentDefault({ role, url, contribution, challenge, gridSlug, submission }: {
    role: ChallengeRepoRole;
    url: string;
    contribution: Contribution;
    challenge: Challenge;
    gridSlug: string;
    submission: MlSubmissionEvent;
  }): Promise<number> {
    const ref = extractArtifactRef(url);
    if (!ref) throw new Error(`[MlRewardsService] Cannot extract ref from "${url}"`);

    const input: KaggleArtifactInput = { ref, repoType: role === 'dataset' ? 'kaggle_dataset' : 'github' };
    const { evaluation } = await evaluate({
      bundle: { source: KAGGLE_ARTIFACT_SOURCE, input },
      gridSlug,
      subject: {
        title: contribution.title,
        type: gridSlug,
        description: contribution.description,
        ref: challenge.uuid,
        userId: contribution.user_id,
      },
      origin: {
        owner: mlFlowDescriptor.key,
        handler: ML_SUBMISSION_EVALUATION_HANDLER,
        payload: { ...submission },
        challengeId: challenge.uuid,
        contributionId: contribution.uuid,
      },
    });

    await this.deps.contributionRepo.update(contribution.uuid, { evaluation });

    // globalScore est sur 0–9 (scores 0–9 × poids sommant à ~1).
    return Math.min(1, Math.max(0, evaluation.globalScore / 9));
  }

  private async resolveLineage(challenge: Challenge, userId: string): Promise<MlLineage> {
    const all = await this.deps.contributionRepo.findByChallenge(challenge.uuid);

    // Datasets attachés à la construction du modèle (sélection communauté) —
    // union de tous les repos dataset du challenge, généralement un seul.
    // workspace_meta.datasetUrls garde les URLs brutes (comme userUrls, pour un
    // aller-retour GET/PATCH sûr) ; on les normalise ici pour matcher
    // contribution.artifact_url, déjà normalisée à la soumission.
    const datasetRepos = await this.deps.challengeRepoRepo.findByChallengeAndRole(challenge.uuid, 'dataset');
    const myDatasetUrls = [...new Set(
      datasetRepos
        .flatMap(r => {
          const meta = r.workspace_meta as { datasetUrls?: Record<string, string[]> } | undefined;
          return meta?.datasetUrls?.[userId] ?? [];
        })
        .map(url => normalizeArtifactUrl(url))
        .filter((u): u is string => !!u)
    )];

    return resolveLineage(all, userId, myDatasetUrls);
  }
}
