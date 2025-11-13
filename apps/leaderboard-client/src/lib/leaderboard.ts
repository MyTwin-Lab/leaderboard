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
}: {
  contributions: Contribution[];
  challenges: Challenge[];
  users: User[];
  projectId?: string | null;
}): AggregatedUser[] {
  const challengeById = new Map<string, Challenge>(
    challenges.map((challenge) => [challenge.uuid, challenge])
  );
  const userById = new Map<string, User>(users.map((user) => [user.uuid, user]));
  const totals = new Map<string, number>();

  for (const contribution of contributions) {
    const targetUser = userById.get(contribution.user_id);
    if (!targetUser) continue;

    const challenge = challengeById.get(contribution.challenge_id);
    if (projectId && challenge?.project_id !== projectId) {
      continue;
    }

    const reward = contribution.reward ?? 0;
    totals.set(contribution.user_id, (totals.get(contribution.user_id) ?? 0) + reward);
  }

  return Array.from(totals.entries())
    .map(([userId, totalCP]) => {
      const user = userById.get(userId);
      if (!user) return null;
      return { user, totalCP } satisfies AggregatedUser;
    })
    .filter((entry): entry is AggregatedUser => entry !== null);
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
  const sorted = [...entries].sort((a, b) => b.totalCP - a.totalCP);

  let currentRank = 0;
  let previousScore = Number.POSITIVE_INFINITY;

  return sorted.map((entry, index) => {
    if (entry.totalCP < previousScore) {
      currentRank = index + 1;
      previousScore = entry.totalCP;
    }

    return {
      rank: currentRank,
      userId: entry.user.uuid,
      displayName: entry.user.full_name,
      githubUsername: entry.user.github_username,
      totalCP: entry.totalCP,
    } satisfies LeaderboardEntry;
  });
}
