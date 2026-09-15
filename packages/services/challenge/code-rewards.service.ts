import { computeCodeAward } from "../../evaluator/code-reward.js";
import {
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  ContributionMemberRepository,
  ContributionRepository,
  RewardEntryRepository,
  TaskRepository,
} from "../../database-service/repositories/index.js";
import { isEvaluationRunning } from "../../database-service/repositories/contribution.repo.js";
import { splitShares } from "../../database-service/domain/share.js";
import { getGroupContext, type GroupContext } from "../../capabilities/groups.js";
import type { Challenge, ChallengeTeam, Contribution } from "../../database-service/domain/entities.js";
import { parseCodeRewardRules } from "../../database-service/domain/codeRewardRules.js";
import {
  ensureDatabaseGridProvider,
  evaluateGithubRepo,
  parseGithubRepoUrl,
} from "./repo-evaluation.js";

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
    const parsed = parseGithubRepoUrl(participation.workspace_url);
    if (!parsed) return null;
    return { slug: parsed.slug, branch: parsed.branch };
  }
  return null;
}

interface EvaluationPlan {
  challenge: Challenge;
  rules: NonNullable<ReturnType<typeof parseCodeRewardRules>>;
  group: GroupContext;
  participation: ChallengeTeam;
  target: { slug: string; branch?: string };
}

export interface CodeRewardsDeps {
  challengeRepo: Pick<ChallengeRepository, "findById" | "update">;
  /** `findByChallenge` sert la résolution du groupe (voir group.ts). */
  challengeTeamRepo: Pick<ChallengeTeamRepository, "findByChallengeAndUser" | "findByChallenge">;
  challengeRepoRepo: Pick<ChallengeRepoRepository, "findByChallengeWithRepo">;
  taskRepo: Pick<TaskRepository, "findPersonalTasks">;
  contributionRepo: Pick<ContributionRepository, "findByChallenge" | "createIfAbsent" | "claimEvaluation" | "update">;
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

  constructor(deps?: Partial<CodeRewardsDeps>) {
    // Le registre de grilles est statique : l'installer une fois suffit, et
    // `repo-evaluation.ts` porte le drapeau pour tous ses appelants.
    ensureDatabaseGridProvider();
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
    // Même règle que la garde SQL de `claimEvaluation` : un `running` orphelin
    // (process mort en plein run) ne bloque plus le bouton passé le délai.
    if (contribution && isEvaluationRunning(contribution)) return { ok: false, reason: "already_running" };

    return { ok: true };
  }

  /**
   * Prise du run — attendue par la route **avant** son 202.
   *
   * La bascule vers `running` est un compare-and-set en base
   * (`ContributionRepository.claimEvaluation`), et non plus une relecture
   * suivie d'une écriture inconditionnelle dans le run planifié : de deux
   * lancements concurrents, un seul obtient la ligne, l'autre reçoit
   * `already_running` et la route répond 409 sans rien planifier. Un `running`
   * plus vieux que `EVALUATION_STALE_AFTER_MS` (process mort en plein run)
   * redevient prenable.
   *
   * Premier run : la contribution n'existe pas encore, `createIfAbsent` la
   * crée directement `running` sous verrou. Si un appel concurrent l'a créée
   * entre notre lecture et le verrou, on retombe sur le compare-and-set, qui
   * tranche.
   */
  async claim(event: CodeEvaluationEvent): Promise<{ ok: boolean; reason?: CannotEvaluateReason }> {
    const { challengeId, userId } = event;

    const plan = await this.plan(challengeId, userId);
    if (typeof plan === "string") return { ok: false, reason: plan };
    const { challenge, participation, group: { ownerId } } = plan;

    let contribution = await this.findContribution(challengeId, ownerId);
    if (!contribution) {
      const result = await this.deps.contributionRepo.createIfAbsent({
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
      if (result.created) return { ok: true };
      contribution = result.contribution;
    }

    const claimed = await this.deps.contributionRepo.claimEvaluation(contribution.uuid, {
      artifact_url: participation.workspace_url,
    });
    if (!claimed) {
      console.log(`[CodeRewardsService] Evaluation already running for ${ownerId} on ${challengeId} — skipping`);
      return { ok: false, reason: "already_running" };
    }
    return { ok: true };
  }

  /**
   * Fire-and-forget : l'appel agent dure des dizaines de secondes, le statut
   * vit sur la contribution. À n'appeler qu'après un `claim` réussi.
   */
  scheduleRun(event: CodeEvaluationEvent): void {
    this.run(event).catch((error) => {
      console.error(`[CodeRewardsService] Evaluation failed for ${event.userId} on ${event.challengeId}:`, error);
    });
  }

  /** `claim` puis `run` d'un seul tenant, pour un appelant qui peut attendre. */
  async evaluate(event: CodeEvaluationEvent): Promise<void> {
    const { ok } = await this.claim(event);
    if (!ok) return;
    await this.run(event);
  }

  /**
   * Le run lui-même. Rien ne transite depuis `claim` (la route a répondu
   * entre-temps) : le plan est rétabli ici, et une contribution qui n'est pas
   * `running` veut dire qu'aucun run n'a été pris — on ne fait rien.
   */
  async run(event: CodeEvaluationEvent): Promise<void> {
    const { challengeId, userId } = event;

    // Le plan tenait au claim, quelques millisecondes plus tôt. S'il ne tient
    // plus, la contribution reste `running` et redevient prenable passé
    // EVALUATION_STALE_AFTER_MS.
    const plan = await this.plan(challengeId, userId);
    if (typeof plan === "string") return;
    const { challenge, rules, group, target } = plan;
    const { ownerId } = group;

    const contribution = await this.findContribution(challengeId, ownerId);
    if (!contribution || contribution.evaluation_status !== "running") {
      console.log(`[CodeRewardsService] No claimed run for ${ownerId} on ${challengeId} — skipping`);
      return;
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

  /**
   * Ce que `claim` et `run` établissent chacun de leur côté : le challenge,
   * ses règles, le groupe et le workspace à évaluer. Une chaîne est la raison
   * pour laquelle il n'y a rien à évaluer.
   */
  private async plan(challengeId: string, userId: string): Promise<EvaluationPlan | CannotEvaluateReason> {
    const challenge = await this.deps.challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== "code") return "not_code_challenge";
    const rules = parseCodeRewardRules(challenge.reward_rules);
    if (!rules) {
      console.warn(`[CodeRewardsService] Challenge ${challengeId} has no code reward rules — skipping`);
      return "no_rules";
    }

    // Un membre de groupe déclenche l'évaluation du workspace du porteur : un
    // groupe a un board, une branche et une contribution, pas un par membre.
    const group = await this.loadGroup(challengeId, userId);

    const participation = await this.deps.challengeTeamRepo.findByChallengeAndUser(challengeId, group.ownerId);
    if (!participation) return "not_participant";
    const target = await this.resolveTarget(challenge, participation);
    if (!target) {
      console.warn(`[CodeRewardsService] No resolvable workspace for ${group.ownerId} on ${challengeId}`);
      return "workspace_not_ready";
    }

    return { challenge, rules, group, participation, target };
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
      const fromUrl = parseGithubRepoUrl(participation.workspace_url)?.slug;
      if (fromUrl) return resolveWorkspaceTarget(participation, fromUrl);

      const repos = await this.deps.challengeRepoRepo.findByChallengeWithRepo(challenge.uuid);
      const codeRepo = repos.find(r => r.repo_type === "github" && r.repo_external_id);
      return resolveWorkspaceTarget(participation, codeRepo?.repo_external_id ?? undefined);
    }
    return resolveWorkspaceTarget(participation, undefined);
  }

  /**
   * Snapshot agrégé (≤100 commits) sur la branche/le repo, grille `code`, note
   * ramenée /10 — le cœur est partagé avec l'évaluation formative du sandbox
   * (`repo-evaluation.ts`), ce service ne garde ici que la traduction de ses
   * propres objets (contribution, challenge) vers le sujet évalué.
   */
  private runAgentDefault({ slug, branch, contribution, challenge }: {
    slug: string; branch?: string; contribution: Contribution; challenge: Challenge;
  }): Promise<{ score10: number; evaluation: unknown }> {
    return evaluateGithubRepo({
      slug,
      branch,
      gridSlug: "code",
      subject: {
        title: contribution.title,
        type: "code",
        description: contribution.description,
        challengeId: challenge.uuid,
        userId: contribution.user_id,
      },
      hasPriorEvaluation: !!contribution.evaluation,
    });
  }
}
