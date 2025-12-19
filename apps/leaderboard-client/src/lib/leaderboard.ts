import type {
  Contribution,
  Challenge,
  User,
  Project,
} from "../../../../packages/database-service/domain/entities.js";

import type { LeaderboardEntry, ProjectFilter } from "./types";

export type AggregatedUser = {
  user: User;
  totalCP: number;
};

export function aggregateUsersByContribution({
  contributions,
  challenges,
  users,
  projectId,
  timePeriod,
}: {
  contributions: Contribution[];
  challenges: Challenge[];
  users: User[];
  projectId?: string | null;
  timePeriod?: "all" | "month" | "week";
}): AggregatedUser[] {
  const challengeById = new Map<string, Challenge>(
    challenges.map((challenge) => [challenge.uuid, challenge])
  );
  const userById = new Map<string, User>(users.map((user) => [user.uuid, user]));
  const totals = new Map<string, number>();

  // Calculate the date threshold based on time period
  let dateThreshold: Date | null = null;
  if (timePeriod === "week") {
    dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - 7);
  } else if (timePeriod === "month") {
    dateThreshold = new Date();
    dateThreshold.setMonth(dateThreshold.getMonth() - 1);
  }

  for (const contribution of contributions) {
    const targetUser = userById.get(contribution.user_id);
    if (!targetUser) continue;

    const challenge = challengeById.get(contribution.challenge_id);
    if (projectId && challenge?.project_id !== projectId) {
      continue;
    }

    // Filter by time period
    if (dateThreshold && contribution.submitted_at < dateThreshold) {
      continue;
    }

    const reward = contribution.reward ?? 0;
    totals.set(contribution.user_id, (totals.get(contribution.user_id) ?? 0) + reward);
  }

  // Include all users, even those with 0 CP
  return Array.from(userById.values()).map((user) => ({
    user,
    totalCP: totals.get(user.uuid) ?? 0,
  }));
}

export function buildProjectFilters(projects: Project[]): ProjectFilter[] {
  const sorted = [...projects].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );

  return [
    { id: null, name: "All Projects" },
    ...sorted.map((project) => ({
      id: project.uuid,
      name: project.title,
    })),
  ];
}

export function rankEntries(entries: AggregatedUser[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Sort by totalCP descending
    if (b.totalCP !== a.totalCP) {
      return b.totalCP - a.totalCP;
    }
    // If equal CP, sort alphabetically by full name
    return a.user.full_name.localeCompare(b.user.full_name);
  });

  return sorted.map((entry, index) => ({
    rank: index + 1,
    userId: entry.user.uuid,
    displayName: entry.user.full_name,
    githubUsername: entry.user.github_username,
    bio: entry.user.bio,
    totalCP: entry.totalCP,
  }));
}
