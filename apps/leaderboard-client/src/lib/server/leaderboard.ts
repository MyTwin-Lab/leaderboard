import "server-only";

import { repositories } from "@/lib/db";
import { aggregateUsersByContribution, buildProjectFilters, rankEntries } from "@/lib/leaderboard";
import type { ContributorProfile, LeaderboardResponse } from "@/lib/types";

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`);
    this.name = "ProjectNotFoundError";
  }
}

export async function fetchLeaderboard(
  projectId?: string,
  timePeriod?: "all" | "month" | "week"
): Promise<LeaderboardResponse> {
  const [projects, contributions, challenges, users, contributionMembers, sandboxRewards] =
    await Promise.all([
      repositories.project.findAll(),
      repositories.contribution.findAll(),
      repositories.challenge.findAll(),
      repositories.user.findAll(),
      repositories.contributionMember.findAll(),
      // Ledger sandbox complet : l'agrégation le filtre elle-même par période,
      // et l'écarte entièrement dès qu'un projet est sélectionné.
      repositories.sandboxReward.findAll(),
    ]);

  let selectedProjectId: string | null = null;
  if (projectId && projectId !== "all") {
    const exists = projects.some((project) => project.uuid === projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }
    selectedProjectId = projectId;
  }

  const aggregated = aggregateUsersByContribution({
    contributions,
    challenges,
    users,
    contributionMembers,
    sandboxRewards,
    projectId: selectedProjectId,
    timePeriod: timePeriod ?? "all",
  });

  return {
    // Les comptes à 0 CP restent hors du payload : filtrer côté client
    // laissait nom, GitHub et bio de tous les inscrits dans le RSC.
    entries: rankEntries(aggregated.filter((a) => a.totalCP > 0)),
    filters: {
      projects: buildProjectFilters(projects),
    },
  } satisfies LeaderboardResponse;
}

export async function fetchContributorProfile(userId: string, viewerId?: string | null): Promise<ContributorProfile | null> {
  const user = await repositories.user.findById(userId);
  if (!user) {
    return null;
  }

  const [
    ownContributions, challenges, projects, allContributions, allUsers, myShares, allMembers,
    mySandboxes, mySandboxRewards, allSandboxRewards,
  ] = await Promise.all([
    repositories.contribution.findByUser(userId),
    repositories.challenge.findAll(),
    repositories.project.findAll(),
    repositories.contribution.findAll(),
    repositories.user.findAll(),
    repositories.contributionMember.findByUser(userId),
    repositories.contributionMember.findAll(),
    // Les siens, archivés compris : un sandbox archivé qui a payé un palier
    // garde ses CP, il doit donc rester lisible sur la fiche.
    repositories.sandbox.findByUser(userId),
    repositories.sandboxReward.findByUser(userId),
    // Le ledger complet, pour que le rang global se calcule sur les mêmes
    // totaux que le classement lui-même.
    repositories.sandboxReward.findAll(),
  ]);

  // `findByUser` ne voit que ce qu'on a soumis : sur une contribution de
  // groupe, `contributions.user_id` est le porteur. Un co-membre ne verrait
  // donc rien de son propre travail sans ce complément.
  const shareByContribution = new Map(myShares.map((m) => [m.contribution_id, m.share_cp]));

  // Co-équipiers de chaque contribution de groupe, pour les pastilles. Soi-même
  // est retiré : la fiche dit "j'ai fait ça avec X et Y", pas "avec moi".
  const userById = new Map(allUsers.map((u) => [u.uuid, u]));
  const coMembersByContribution = new Map<string, ContributorProfile["challenges"][number]["contributions"][number]["coMembers"]>();
  for (const member of allMembers) {
    if (member.user_id === userId) continue;
    if (!shareByContribution.has(member.contribution_id)) continue;
    const user = userById.get(member.user_id);
    if (!user) continue;
    const list = coMembersByContribution.get(member.contribution_id) ?? [];
    list.push({ id: user.uuid, fullName: user.full_name, avatarUrl: user.avatar_url ?? undefined });
    coMembersByContribution.set(member.contribution_id, list);
  }
  const ownIds = new Set(ownContributions.map((c) => c.uuid));
  const contributions = [
    ...ownContributions,
    ...allContributions.filter((c) => shareByContribution.has(c.uuid) && !ownIds.has(c.uuid)),
  ];

  const challengeById = new Map(challenges.map((challenge) => [challenge.uuid, challenge]));
  const projectById = new Map(projects.map((project) => [project.uuid, project]));

  const aggregatedMap = new Map<string, ContributorProfile["challenges"][number]>();
  // CP gagnés via les signaux Slack, par challenge. Ils comptent dans le total
  // du contributeur mais pas dans sa part du pool (ils sont hors pool).
  const discussionCpByChallenge = new Map<string, number>();

  for (const contribution of contributions) {
    const challenge = challengeById.get(contribution.challenge_id);
    if (!challenge) continue;

    const project = projectById.get(challenge.project_id ?? "");
    // Sur une contribution de groupe, `reward` est le total du groupe : la
    // fiche d'un contributeur montre sa part, pas celle de tout le monde.
    const reward = shareByContribution.get(contribution.uuid) ?? contribution.reward ?? 0;

    let entry = aggregatedMap.get(challenge.uuid);
    if (!entry) {
      entry = {
        id: challenge.uuid,
        title: challenge.title,
        projectName: project?.title ?? "Projet inconnu",
        reward: 0,
        contributionShare: 0,
        contributions: [],
      } satisfies ContributorProfile["challenges"][number];
      aggregatedMap.set(challenge.uuid, entry);
    }

    if (contribution.type === "discussion") {
      // Affichée en chips agrégées, pas dans la liste des contributions.
      entry.discussion = { contributionId: contribution.uuid, totalCp: reward, signals: [] };
      discussionCpByChallenge.set(challenge.uuid, reward);
    } else {
      entry.contributions.push({
        id: contribution.uuid,
        title: contribution.title,
        description: contribution.description ?? null,
        reward,
        submittedAt: contribution.submitted_at ? contribution.submitted_at.toISOString() : null,
        // Only the author can see the AI evaluation detail — everyone can see
        // the contribution itself, so this hint is scoped to the viewer.
        hasEvaluation: contribution.evaluation != null && viewerId === userId,
        coMembers: coMembersByContribution.get(contribution.uuid),
      });
    }

    entry.reward += reward;
    const poolReward = entry.reward - (discussionCpByChallenge.get(challenge.uuid) ?? 0);
    entry.contributionShare =
      challenge.contribution_points_reward > 0
        ? poolReward / challenge.contribution_points_reward
        : 0;
  }

  const aggregated = Array.from(aggregatedMap.values());

  // Détail des signaux par challenge : agrégat du ledger (count + CP par
  // signal), libellés depuis les définitions du challenge, avec repli sur le
  // label historisé dans le ledger si le signal a été supprimé depuis.
  await Promise.all(
    aggregated
      .filter((entry) => entry.discussion)
      .map(async (entry) => {
        const [ledgerEntries, definitions] = await Promise.all([
          repositories.rewardEntry.findByContribution(entry.discussion!.contributionId),
          repositories.challengeSignal.findByChallenge(entry.id),
        ]);
        const definitionById = new Map(definitions.map((d) => [d.uuid, d]));

        const bySignal = new Map<string, { label: string; icon: string | null; count: number; totalCp: number }>();
        for (const ledgerEntry of ledgerEntries) {
          if (ledgerEntry.rule_key !== "slack_signal") continue;
          const signalId = String(ledgerEntry.meta?.signal_id ?? "unknown");
          const definition = definitionById.get(signalId);
          const existing = bySignal.get(signalId) ?? {
            label: definition?.label ?? String(ledgerEntry.meta?.signal_label ?? "Signal"),
            icon: definition?.icon ?? null,
            count: 0,
            totalCp: 0,
          };
          existing.count += 1;
          existing.totalCp += ledgerEntry.points;
          bySignal.set(signalId, existing);
        }

        entry.discussion!.signals = [...bySignal.entries()]
          .map(([signalId, s]) => ({ signalId, ...s }))
          .sort((a, b) => b.totalCp - a.totalCp);
      })
  );
  // Ledger sandbox du contributeur, regroupé par sandbox. `contributionShare`
  // n'est pas touché : il reste la part du pool d'un challenge, et un sandbox
  // n'a pas de pool.
  const sandboxById = new Map(mySandboxes.map((s) => [s.uuid, s]));
  const sandboxesMap = new Map<string, ContributorProfile["sandboxes"][number]>();
  for (const reward of mySandboxRewards) {
    // Défensif : `sandbox_rewards` est en cascade sur `sandboxes` et la fusion
    // de comptes réassigne les deux ensemble, donc la ligne existe toujours.
    const sandbox = sandboxById.get(reward.sandbox_id);
    if (!sandbox) continue;
    let entry = sandboxesMap.get(sandbox.uuid);
    if (!entry) {
      entry = { id: sandbox.uuid, slug: sandbox.slug, title: sandbox.title, status: sandbox.status, totalCP: 0, rewards: [] };
      sandboxesMap.set(sandbox.uuid, entry);
    }
    entry.totalCP += reward.points;
    entry.rewards.push({
      id: reward.uuid,
      ruleKey: reward.rule_key,
      tierStars: reward.tier_stars,
      cp: reward.points,
      awardedAt: reward.created_at ? reward.created_at.toISOString() : null,
    });
  }
  const sandboxes = [...sandboxesMap.values()].sort((a, b) => b.totalCP - a.totalCP);

  // Le total affiché est celui qui classe : challenges **plus** sandbox. Sans
  // les seconds, la fiche contredirait le rang qu'elle annonce juste à côté.
  const challengesCP = aggregated.reduce((acc, item) => acc + item.reward, 0);
  const sandboxCP = mySandboxRewards.reduce((acc, reward) => acc + reward.points, 0);
  const totalCP = challengesCP + sandboxCP;

  // Calculate global rank
  const globalAggregated = aggregateUsersByContribution({
    contributions: allContributions,
    challenges,
    users: allUsers,
    contributionMembers: allMembers,
    sandboxRewards: allSandboxRewards,
    projectId: null,
    timePeriod: "all",
  });
  const rankedEntries = rankEntries(globalAggregated);
  const myIndex = rankedEntries.findIndex(entry => entry.userId === userId);
  const globalRank = myIndex >= 0 ? rankedEntries[myIndex].rank : undefined;

  // CP gap to the nearest adjacent rank — "behind" the rank above (closer to
  // #1), or "ahead" of the rank below when we're already #1. Free: derived
  // from the ranking we just built for globalRank, no extra query.
  let rankGap: ContributorProfile["rankGap"];
  if (myIndex >= 0) {
    const me = rankedEntries[myIndex];
    const above = myIndex > 0 ? rankedEntries[myIndex - 1] : null;
    const below = myIndex < rankedEntries.length - 1 ? rankedEntries[myIndex + 1] : null;
    if (above) {
      const gap = above.totalCP - me.totalCP;
      if (gap > 0) rankGap = { direction: "behind", rank: above.rank, cp: gap };
    } else if (below) {
      const gap = me.totalCP - below.totalCP;
      if (gap > 0) rankGap = { direction: "ahead", rank: below.rank, cp: gap };
    }
  }

  // Earliest submission — a free-form "contributing since" date, derived
  // from the contributions we already fetched above.
  const submittedTimestamps = contributions
    .map(c => c.submitted_at)
    .filter((d): d is Date => d != null)
    .map(d => d.getTime());
  const contributingSince = submittedTimestamps.length > 0
    ? new Date(Math.min(...submittedTimestamps)).toISOString()
    : undefined;

  // Average AI evaluation score — private to the profile owner, same rule
  // as `hasEvaluation` on individual contributions. `evaluation` is an
  // untyped JSON column; `globalScore` is the 0–100 field the evaluator
  // agent writes (see packages/evaluator/README.md).
  let avgEvaluationScore: number | undefined;
  let evaluatedContributionsCount: number | undefined;
  if (viewerId === userId) {
    const scores = contributions
      .map(c => {
        const evaluation = c.evaluation as { globalScore?: unknown } | null | undefined;
        return evaluation && typeof evaluation === "object" ? evaluation.globalScore : undefined;
      })
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    if (scores.length > 0) {
      avgEvaluationScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      evaluatedContributionsCount = scores.length;
    }
  }

  return {
    userId: user.uuid,
    displayName: user.full_name,
    githubUsername: user.github_username,
    bio: user.bio,
    avatarUrl: user.avatar_url ?? undefined,
    totalCP,
    challenges: aggregated,
    sandboxes,
    globalRank,
    rankGap,
    contributingSince,
    avgEvaluationScore,
    evaluatedContributionsCount,
  } satisfies ContributorProfile;
}
