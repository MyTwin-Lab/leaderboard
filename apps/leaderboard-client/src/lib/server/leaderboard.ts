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

export async function fetchLeaderboard(projectId?: string): Promise<LeaderboardResponse> {
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
  });

  return {
    entries: rankEntries(aggregated),
    filters: {
      projects: buildProjectFilters(projects),
    },
  } satisfies LeaderboardResponse;
}

export async function fetchContributorProfile(userId: string): Promise<ContributorProfile | null> {
  const user = await repositories.user.findById(userId);
  if (!user) {
    return null;
  }

  const [contributions, challenges, projects] = await Promise.all([
    repositories.contribution.findByUser(userId),
    repositories.challenge.findAll(),
    repositories.project.findAll(),
  ]);

  const challengeById = new Map(challenges.map((challenge) => [challenge.uuid, challenge]));
  const projectById = new Map(projects.map((project) => [project.uuid, project]));

  const aggregatedMap = new Map<string, ContributorProfile["challenges"][number]>();

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

    entry.contributions.push({
      id: contribution.uuid,
      title: contribution.title,
      description: contribution.description ?? null,
      reward,
    });

    entry.reward += reward;
    entry.contributionShare =
      challenge.contribution_points_reward > 0
        ? entry.reward / challenge.contribution_points_reward
        : 0;
  }

  const aggregated = Array.from(aggregatedMap.values());
  const totalCP = aggregated.reduce((acc, item) => acc + item.reward, 0);

  return {
    userId: user.uuid,
    displayName: user.full_name,
    githubUsername: user.github_username,
    totalCP,
    challenges: aggregated,
  } satisfies ContributorProfile;
}
