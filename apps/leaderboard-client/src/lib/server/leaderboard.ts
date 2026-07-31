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
  const [projects, contributions, challenges, users] = await Promise.all([
    repositories.project.findAll(),
    repositories.contribution.findAll(),
    repositories.challenge.findAll(),
    repositories.user.findAll(),
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
    projectId: selectedProjectId,
    timePeriod: timePeriod ?? "all",
  });

  return {
    entries: rankEntries(aggregated),
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

  const [contributions, challenges, projects, allContributions, allUsers] = await Promise.all([
    repositories.contribution.findByUser(userId),
    repositories.challenge.findAll(),
    repositories.project.findAll(),
    repositories.contribution.findAll(),
    repositories.user.findAll(),
  ]);

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
    const reward = contribution.reward ?? 0;

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
  const totalCP = aggregated.reduce((acc, item) => acc + item.reward, 0);

  // Calculate global rank
  const globalAggregated = aggregateUsersByContribution({
    contributions: allContributions,
    challenges,
    users: allUsers,
    projectId: null,
    timePeriod: "all",
  });
  const rankedEntries = rankEntries(globalAggregated);
  const globalRank = rankedEntries.find(entry => entry.userId === userId)?.rank;

  return {
    userId: user.uuid,
    displayName: user.full_name,
    githubUsername: user.github_username,
    avatarUrl: user.avatar_url,
    totalCP,
    challenges: aggregated,
    globalRank,
  } satisfies ContributorProfile;
}
