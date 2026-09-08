import { OpenAIAgentEvaluator } from "../../evaluator/evaluator.js";
import { EvaluationGridRegistry } from "../../evaluator/grids/index.js";
import { computeCodeAward } from "../../evaluator/code-reward.js";
import type { EvaluateContext, SnapshotInfo } from "../../evaluator/types.js";
import {
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  ContributionMemberRepository,
  ContributionRepository,
  RewardEntryRepository,
  TaskRepository,
} from "../../database-service/repositories/index.js";
import { splitShares } from "../../evaluator/share.js";
import { getGroupContext, type GroupContext } from "./group.js";
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
  | "already_running"
  | "challenge_closed";

/**
 * Parse `owner/repo` (+ branche optionnelle) depuis une URL GitHub — repo
 * racine ou `/tree/<branch>`. Seul point de vérité pour ce regex, partagé par
 * `resolveWorkspaceTarget` (mode `external`) et `resolveTarget` (fallback du
 * mode `github`).
 */
function parseGithubUrl(url?: string): { slug: string; branch?: string } | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^?#]+))?(?:[?#]|$)/);
  if (!m) return null;
  return { slug: `${m[1]}/${m[2]}`, branch: m[3] ?? undefined };
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
    const parsed = parseGithubUrl(participation.workspace_url);
    if (!parsed) return null;
    return { slug: parsed.slug, branch: parsed.branch };
  }
  return null;
}

export interface CodeRewardsDeps {
  challengeRepo: Pick<ChallengeRepository, "findById" | "update">;
  /** `findByChallenge` sert la résolution du groupe (voir group.ts). */
  challengeTeamRepo: Pick<ChallengeTeamRepository, "findByChallengeAndUser" | "findByChallenge">;
  challengeRepoRepo: Pick<ChallengeRepoRepository, "findByChallengeWithRepo">;
  taskRepo: Pick<TaskRepository, "findPersonalTasks">;
  contributionRepo: Pick<ContributionRepository, "findByChallenge" | "create" | "update">;
  rewardRepo: Pick<RewardEntryRepository, "findByUserAndChallenge" | "sumByChallenge" | "createManyAndSyncRewards">;
  contributionMemberRepo: Pick<ContributionMemberRepository, "addShares">;
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
  private static dbProviderInitialized = false;

  constructor(deps?: Partial<CodeRewardsDeps>) {
    if (!CodeRewardsService.dbProviderInitialized) {
      EvaluationGridRegistry.setDatabaseProvider(new DatabaseGridProvider());
      CodeRewardsService.dbProviderInitialized = true;
    }
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      challengeTeamRepo: new ChallengeTeamRepository(),
      challengeRepoRepo: new ChallengeRepoRepository(),
      taskRepo: new TaskRepository(),
      contributionRepo: new ContributionRepository(),
      rewardRepo: new RewardEntryRepository(),
      contributionMemberRepo: new ContributionMemberRepository(),
      runAgent: (input) => this.runAgentDefault(input),
      ...deps,
    };
  }

  /**
   * Le groupe de travail de l'appelant sur ce challenge.
   *
   * Tout ce qui suit (board, branche, contribution, ledger) est ancré sur
   * `ownerId` et non sur l'appelant : un groupe partage un workspace, donc une
   * seule livraison et un seul jeu de lignes de ledger. En solo `ownerId` vaut
   * l'appelant, et le flux est identique à ce qu'il a toujours été.
   */
  private loadGroup(challengeId: string, userId: string): Promise<GroupContext> {
    return getGroupContext(challengeId, userId, { challengeTeamRepo: this.deps.challengeTeamRepo });
  }

  /** Préconditions du bouton "Lancer l'évaluation" — partagées entre la route et l'UI (raison affichable). */
  async canEvaluate(challengeId: string, userId: string): Promise<{ ok: boolean; reason?: CannotEvaluateReason }> {
    const challenge = await this.deps.challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== "code") return { ok: false, reason: "not_code_challenge" };
    if (challenge.status === "completed" || challenge.status === "archived") {
      return { ok: false, reason: "challenge_closed" };
    }
    if (!parseCodeRewardRules(challenge.reward_rules)) return { ok: false, reason: "no_rules" };

    // La participation de l'appelant décide s'il a le droit de lancer ;
    // celle du porteur porte le workspace à évaluer. Les deux coïncident en solo.
    const callerParticipation = await this.deps.challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (!callerParticipation) return { ok: false, reason: "not_participant" };

    const { ownerId } = await this.loadGroup(challengeId, userId);
    const participation = ownerId === userId
      ? callerParticipation
      : await this.deps.challengeTeamRepo.findByChallengeAndUser(challengeId, ownerId);
    if (!participation) return { ok: false, reason: "not_participant" };

    const workspaceReady =
      participation.workspace_provider === "external"
        ? !!participation.workspace_url
        : participation.workspace_status === "ready";
    if (!workspaceReady) return { ok: false, reason: "workspace_not_ready" };

    const tasks = await this.deps.taskRepo.findPersonalTasks(challengeId, ownerId);
    if (tasks.length === 0) return { ok: false, reason: "no_tasks" };
    if (tasks.some(t => t.status !== "done")) return { ok: false, reason: "tasks_not_done" };

    const contribution = await this.findContribution(challengeId, ownerId);
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

    // Un membre de groupe déclenche l'évaluation du workspace du porteur : un
    // groupe a un board, une branche et une contribution, pas un par membre.
    const group = await this.loadGroup(challengeId, userId);
    const { ownerId } = group;

    const participation = await this.deps.challengeTeamRepo.findByChallengeAndUser(challengeId, ownerId);
    if (!participation) return;
    const target = await this.resolveTarget(challenge, participation);
    if (!target) {
      console.warn(`[CodeRewardsService] No resolvable workspace for ${ownerId} on ${challengeId}`);
      return;
    }

    // Upsert de la contribution projet, statut pending → running. Re-fetch
    // juste avant l'upsert (et non seulement dans canEvaluate) pour fermer la
    // fenêtre où deux appels concurrents du même utilisateur passeraient tous
    // les deux la précondition avant que l'un des deux ne pose "running".
    let contribution = await this.findContribution(challengeId, ownerId);
    if (contribution?.evaluation_status === "running") {
      console.log(`[CodeRewardsService] Evaluation already running for ${ownerId} on ${challengeId} — skipping`);
      return;
    }
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
        user_id: ownerId,
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
        this.deps.rewardRepo.findByUserAndChallenge(ownerId, challengeId),
        this.deps.rewardRepo.sumByChallenge(challengeId, { excludeRuleKeys: ["slack_signal"] }),
      ]);
      const sumFor = (key: string) =>
        existingEntries.filter(e => e.rule_key === key).reduce((s, e) => s + e.points, 0);

      const drafts = computeCodeAward({
        rules,
        challengeId,
        userId: ownerId,
        contributionId: contribution.uuid,
        score: score10,
        alreadyAwarded: { code_fixed: sumFor("code_fixed"), code_quality: sumFor("code_quality") },
        remainingPool: Math.max(0, challenge.contribution_points_reward - distributed),
        groupMultiplier: group.multiplier,
      });

      if (drafts.length > 0) {
        await this.deps.rewardRepo.createManyAndSyncRewards(drafts);
        await this.recordGroupShares(group, contribution.uuid, drafts);
      }
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: "done" });

      // Complétion = fraction du pool drainé, comme en ML.
      const newDistributed = await this.deps.rewardRepo.sumByChallenge(challengeId, { excludeRuleKeys: ["slack_signal"] });
      const completion = challenge.contribution_points_reward > 0
        ? Math.min(1, newDistributed / challenge.contribution_points_reward)
        : 0;
      await this.deps.challengeRepo.update(challenge.uuid, { completion });

      const net = drafts.reduce((s, d) => s + d.points, 0);
      const who = group.groupId ? `group ${group.groupId} (${group.memberIds.length})` : ownerId;
      console.log(`[CodeRewardsService] ${net} CP to ${who} (score ${score10}/10, ${drafts.length} ledger rows)`);
    } catch (error) {
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: "failed" });
      throw error;
    }
  }

  /**
   * Répartit le delta de CP de ce run entre les membres du groupe.
   *
   * On répartit le **delta**, pas le total de la contribution : le ledger est
   * append-only et `share_cp` s'additionne (voir ContributionMemberRepository).
   * Un membre arrivé après un premier run n'a donc de part que sur ce qui a
   * suivi son arrivée, sans qu'on ait à figer quoi que ce soit.
   *
   * Rien n'est écrit pour un solo : l'absence de rows signifie "tout revient à
   * `contributions.user_id`", ce qui laisse le comportement historique intact.
   */
  private async recordGroupShares(
    group: GroupContext,
    contributionId: string,
    drafts: Array<{ points: number }>
  ): Promise<void> {
    if (group.memberIds.length <= 1) return;

    const delta = drafts.reduce((sum, d) => sum + d.points, 0);
    if (delta === 0) return; // pas de rows à 0 : elles ne diraient rien

    const shares = splitShares(delta, group.memberIds, group.ownerId);
    await this.deps.contributionMemberRepo.addShares(
      [...shares].map(([user_id, share_cp]) => ({ contribution_id: contributionId, user_id, share_cp }))
    );
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
      const fromUrl = parseGithubUrl(participation.workspace_url)?.slug;
      if (fromUrl) return resolveWorkspaceTarget(participation, fromUrl);

      const repos = await this.deps.challengeRepoRepo.findByChallengeWithRepo(challenge.uuid);
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
