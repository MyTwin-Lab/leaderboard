import { OpenAIAgentEvaluator } from "../../evaluator/evaluator.js";
import { EvaluationGridRegistry } from "../../evaluator/grids/index.js";
import { computeCodeAward } from "../../evaluator/code-reward.js";
import type { EvaluateContext, SnapshotInfo } from "../../evaluator/types.js";
import {
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  ContributionRepository,
  RewardEntryRepository,
  TaskRepository,
} from "../../database-service/repositories/index.js";
import type { Challenge, ChallengeTeam, Contribution } from "../../database-service/domain/entities.js";
import { parseCodeRewardRules } from "../../database-service/domain/codeRewardRules.js";
import { ConnectorRegistry } from "../../connectors/registry.js";
import { SnapshotService } from "./snapshot.service.js";
import { DatabaseGridProvider } from "../database-grid-provider.js";

/** Une contribution "projet global" par (challenge, user) — le pendant code de dataset/model/api_packaging. */
export const PROJECT_CONTRIBUTION_TYPE = "project";
const PROJECT_CONTRIBUTION_TITLE = "Project delivery";

export interface CodeEvaluationEvent {
  challengeId: string;
  userId: string;
}

export type CannotEvaluateReason =
  | "not_code_challenge"
  | "no_rules"
  | "not_participant"
  | "workspace_not_ready"
  | "no_tasks"
  | "tasks_not_done"
  | "already_running";

/** Parse `owner/repo` depuis une URL GitHub (repo racine ou `/tree/<branch>`). */
function extractGithubSlug(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^?#]+))?(?:[?#]|$)/);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

/**
 * Où lire le code à évaluer.
 * - provider 'github' (mode provided_repo) : le repo du challenge, sur la branche perso.
 * - provider 'external' (mode own_repo) : le repo GitHub public du contributeur.
 */
export function resolveWorkspaceTarget(
  participation: ChallengeTeam,
  codeRepoExternalId?: string
): { slug: string; branch?: string } | null {
  if (participation.workspace_provider === "github") {
    if (!codeRepoExternalId || !participation.workspace_ref) return null;
    return { slug: codeRepoExternalId, branch: participation.workspace_ref.replace("refs/heads/", "") };
  }
  if (participation.workspace_provider === "external" && participation.workspace_url) {
    const m = participation.workspace_url.match(
      /github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^?#]+))?(?:[?#]|$)/
    );
    if (!m) return null;
    return { slug: `${m[1]}/${m[2]}`, branch: m[3] ?? undefined };
  }
  return null;
}

export interface CodeRewardsDeps {
  challengeRepo: Pick<ChallengeRepository, "findById" | "update">;
  challengeTeamRepo: Pick<ChallengeTeamRepository, "findByChallengeAndUser">;
  taskRepo: Pick<TaskRepository, "findPersonalTasks">;
  contributionRepo: Pick<ContributionRepository, "findByChallenge" | "create" | "update">;
  rewardRepo: Pick<RewardEntryRepository, "findByUserAndChallenge" | "sumByChallenge" | "createManyAndSyncRewards">;
  /** Isole l'accès réseau (GitHub + OpenAI) — remplacé par un fake en test. */
  runAgent: (input: {
    slug: string;
    branch?: string;
    contribution: Contribution;
    challenge: Challenge;
  }) => Promise<{ score10: number; evaluation: unknown }>;
}

/**
 * CodeRewardsService
 * ------------------
 * Attribution live des points sur les challenges code à boards personnels.
 * Même philosophie que MlRewardsService : chaque run d'évaluation produit des
 * lignes de ledger immuables, clampées au pool restant. La spécificité est le
 * delta itératif — voir computeCodeAward.
 */
export class CodeRewardsService {
  private deps: CodeRewardsDeps;
  private snapshotService = new SnapshotService();
  private evaluator = new OpenAIAgentEvaluator();
  private challengeRepoRepo = new ChallengeRepoRepository();
  private static dbProviderInitialized = false;

  constructor(deps?: Partial<CodeRewardsDeps>) {
    if (!CodeRewardsService.dbProviderInitialized) {
      EvaluationGridRegistry.setDatabaseProvider(new DatabaseGridProvider());
      CodeRewardsService.dbProviderInitialized = true;
    }
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      challengeTeamRepo: new ChallengeTeamRepository(),
      taskRepo: new TaskRepository(),
      contributionRepo: new ContributionRepository(),
      rewardRepo: new RewardEntryRepository(),
      runAgent: (input) => this.runAgentDefault(input),
      ...deps,
    };
  }

  /** Préconditions du bouton "Lancer l'évaluation" — partagées entre la route et l'UI (raison affichable). */
  async canEvaluate(challengeId: string, userId: string): Promise<{ ok: boolean; reason?: CannotEvaluateReason }> {
    const challenge = await this.deps.challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== "code") return { ok: false, reason: "not_code_challenge" };
    if (!parseCodeRewardRules(challenge.reward_rules)) return { ok: false, reason: "no_rules" };

    const participation = await this.deps.challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (!participation) return { ok: false, reason: "not_participant" };

    const workspaceReady =
      participation.workspace_provider === "external"
        ? !!participation.workspace_url
        : participation.workspace_status === "ready";
    if (!workspaceReady) return { ok: false, reason: "workspace_not_ready" };

    const tasks = await this.deps.taskRepo.findPersonalTasks(challengeId, userId);
    if (tasks.length === 0) return { ok: false, reason: "no_tasks" };
    if (tasks.some(t => t.status !== "done")) return { ok: false, reason: "tasks_not_done" };

    const contribution = await this.findContribution(challengeId, userId);
    if (contribution?.evaluation_status === "running") return { ok: false, reason: "already_running" };

    return { ok: true };
  }

  /** Fire-and-forget : l'appel agent dure des dizaines de secondes, le statut vit sur la contribution. */
  scheduleEvaluation(event: CodeEvaluationEvent): void {
    this.evaluate(event).catch((error) => {
      console.error(`[CodeRewardsService] Evaluation failed for ${event.userId} on ${event.challengeId}:`, error);
    });
  }

  async evaluate(event: CodeEvaluationEvent): Promise<void> {
    const { challengeId, userId } = event;

    const challenge = await this.deps.challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== "code") return;
    const rules = parseCodeRewardRules(challenge.reward_rules);
    if (!rules) {
      console.warn(`[CodeRewardsService] Challenge ${challengeId} has no code reward rules — skipping`);
      return;
    }

    const participation = await this.deps.challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (!participation) return;
    const target = await this.resolveTarget(challenge, participation);
    if (!target) {
      console.warn(`[CodeRewardsService] No resolvable workspace for ${userId} on ${challengeId}`);
      return;
    }

    // Upsert de la contribution projet, statut pending → running.
    let contribution = await this.findContribution(challengeId, userId);
    if (contribution) {
      contribution = await this.deps.contributionRepo.update(contribution.uuid, {
        artifact_url: participation.workspace_url,
        evaluation_status: "running",
        submitted_at: new Date(),
      });
    } else {
      contribution = await this.deps.contributionRepo.create({
        title: PROJECT_CONTRIBUTION_TITLE,
        type: PROJECT_CONTRIBUTION_TYPE,
        description: `Global delivery for "${challenge.title}"`,
        reward: 0,
        user_id: userId,
        challenge_id: challengeId,
        artifact_url: participation.workspace_url,
        evaluation_status: "running",
        submitted_at: new Date(),
      });
    }

    try {
      const { score10, evaluation } = await this.deps.runAgent({
        slug: target.slug,
        branch: target.branch,
        contribution,
        challenge,
      });

      await this.deps.contributionRepo.update(contribution.uuid, { evaluation });

      const [existingEntries, distributed] = await Promise.all([
        this.deps.rewardRepo.findByUserAndChallenge(userId, challengeId),
        this.deps.rewardRepo.sumByChallenge(challengeId, { excludeRuleKeys: ["slack_signal"] }),
      ]);
      const sumFor = (key: string) =>
        existingEntries.filter(e => e.rule_key === key).reduce((s, e) => s + e.points, 0);

      const drafts = computeCodeAward({
        rules,
        challengeId,
        userId,
        contributionId: contribution.uuid,
        score: score10,
        alreadyAwarded: { code_fixed: sumFor("code_fixed"), code_quality: sumFor("code_quality") },
        remainingPool: Math.max(0, challenge.contribution_points_reward - distributed),
      });

      if (drafts.length > 0) {
        await this.deps.rewardRepo.createManyAndSyncRewards(drafts);
      }
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: "done" });

      // Complétion = fraction du pool drainé, comme en ML.
      const newDistributed = await this.deps.rewardRepo.sumByChallenge(challengeId, { excludeRuleKeys: ["slack_signal"] });
      const completion = challenge.contribution_points_reward > 0
        ? Math.min(1, newDistributed / challenge.contribution_points_reward)
        : 0;
      await this.deps.challengeRepo.update(challenge.uuid, { completion });

      const net = drafts.reduce((s, d) => s + d.points, 0);
      console.log(`[CodeRewardsService] ${net} CP to ${userId} (score ${score10}/10, ${drafts.length} ledger rows)`);
    } catch (error) {
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: "failed" });
      throw error;
    }
  }

  private async findContribution(challengeId: string, userId: string): Promise<Contribution | undefined> {
    const all = await this.deps.contributionRepo.findByChallenge(challengeId);
    return all.find(c => c.user_id === userId && c.type === PROJECT_CONTRIBUTION_TYPE);
  }

  /**
   * `workspace_url` embarque déjà le slug du repo du challenge pour un
   * participant `github` (voir design 3.3 : "URL de la branche
   * provisionnée"). On le parse d'abord — ça évite un aller-retour DB sur le
   * chemin chaud de l'évaluation — et on ne retombe sur
   * `challenge_repos` que si l'URL est absente/imprévue.
   */
  private async resolveTarget(challenge: Challenge, participation: ChallengeTeam) {
    if (participation.workspace_provider === "github") {
      const fromUrl = extractGithubSlug(participation.workspace_url);
      if (fromUrl) return resolveWorkspaceTarget(participation, fromUrl);

      const repos = await this.challengeRepoRepo.findByChallengeWithRepo(challenge.uuid);
      const codeRepo = repos.find(r => r.repo_type === "github" && r.repo_external_id);
      return resolveWorkspaceTarget(participation, codeRepo?.repo_external_id ?? undefined);
    }
    return resolveWorkspaceTarget(participation, undefined);
  }

  /** Snapshot agrégé (≤100 commits) sur la branche/le repo, grille `code`, note ramenée /10. */
  private async runAgentDefault({ slug, branch, contribution, challenge }: {
    slug: string; branch?: string; contribution: Contribution; challenge: Challenge;
  }): Promise<{ score10: number; evaluation: unknown }> {
    const connector = await ConnectorRegistry.createConnector(
      { uuid: "", title: slug, type: "github", external_repo_id: slug, project_id: "" },
      branch ? { branch } : undefined
    );
    if (!connector) throw new Error(`[CodeRewardsService] No GitHub connector for ${slug}`);

    await connector.connect();
    try {
      const items = await connector.fetchItems();
      const shas = items.slice(0, 100).map(i => i.id);
      if (shas.length === 0) throw new Error(`[CodeRewardsService] No commits found on ${slug}${branch ? `@${branch}` : ""}`);

      const aggregated = await this.snapshotService.buildAggregatedSnapshot(() => connector, shas);
      if (!aggregated) throw new Error(`[CodeRewardsService] Unable to build snapshot for ${slug}`);
      const prepared = await this.snapshotService.prepareSnapshot(aggregated);

      const grid = await EvaluationGridRegistry.getGridAsync("code");
      const evalContext: EvaluateContext = { snapshot: prepared as SnapshotInfo, grid };

      const evaluation = await this.evaluator.evaluate(!!contribution.evaluation, {
        title: contribution.title,
        type: "code",
        description: contribution.description,
        challenge_id: challenge.uuid,
        userId: contribution.user_id,
        commitShas: shas,
      }, evalContext);

      // globalScore est sur 0–9 (cf. ml-rewards.service.ts:302) — ramené /10.
      const score10 = Math.min(10, Math.max(0, (evaluation.globalScore / 9) * 10));
      return { score10, evaluation: { scores: evaluation.scores, globalScore: evaluation.globalScore } };
    } finally {
      await connector.disconnect?.();
    }
  }
}
