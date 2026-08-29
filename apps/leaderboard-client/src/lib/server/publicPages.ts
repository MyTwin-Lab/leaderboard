import "server-only";

import { repositories } from "@/lib/db";
import type { ProjectWithChallenges, TrendingChallenge } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

// 7 daily buckets (oldest → newest, today last) over an already-scoped list
// of contributions — mirrors sparkFromContributions() in lib/server/home.ts,
// duplicated locally rather than shared to keep each page's data pass
// independent.
function sparkFromContributions(reference: Date, contributions: { submitted_at: Date }[]): number[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(dayKey(new Date(reference.getTime() - i * DAY_MS)));
  }
  const counts = new Map(days.map((d) => [d, 0]));
  for (const c of contributions) {
    const key = dayKey(c.submitted_at);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return days.map((d) => counts.get(d) ?? 0);
}

export type ChallengesPageData = {
  projects: ProjectWithChallenges[];
  joinedChallengeIds: string[];
};

export async function fetchProjectsWithChallenges(
  userId?: string | null,
  isAdmin = false,
  managedProjectIds: string[] = [],
): Promise<ChallengesPageData & { managedProjectIds: string[] }> {
  const [projects, challenges, contributions, userChallengeTeams, allChallengeTeams] = await Promise.all([
    repositories.project.findAll(),
    repositories.challenge.findAll(),
    repositories.contribution.findAll(),
    userId ? repositories.challengeTeam.findByUser(userId) : Promise.resolve([]),
    repositories.challengeTeam.findAll(),
  ]);

  // Get all users to map team members
  const allUsers = await repositories.user.findAll();
  const usersMap = new Map(allUsers.map(u => [u.uuid, u]));

  const contributionsCountByChallenge = contributions.reduce<Map<string, number>>((acc, contribution) => {
    const current = acc.get(contribution.challenge_id) ?? 0;
    acc.set(contribution.challenge_id, current + 1);
    return acc;
  }, new Map());

  // ── Per-challenge activity: same 7-day window as the home page's trending
  // challenges, so the card design (spark bars, "N contributions this week")
  // can be shared as-is between the two pages.
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const recentContributions = contributions.filter((c) => c.submitted_at >= sevenDaysAgo);

  const contributionsByChallenge = new Map<string, typeof contributions>();
  for (const c of contributions) {
    const list = contributionsByChallenge.get(c.challenge_id) ?? [];
    list.push(c);
    contributionsByChallenge.set(c.challenge_id, list);
  }

  const recentCountByChallenge = new Map<string, number>();
  const activeContributorsByChallenge = new Map<string, Set<string>>();
  for (const c of recentContributions) {
    recentCountByChallenge.set(c.challenge_id, (recentCountByChallenge.get(c.challenge_id) ?? 0) + 1);
    const set = activeContributorsByChallenge.get(c.challenge_id) ?? new Set<string>();
    set.add(c.user_id);
    activeContributorsByChallenge.set(c.challenge_id, set);
  }

  // Group team members by challenge
  const teamMembersByChallenge = allChallengeTeams.reduce<Map<string, { id: string; fullName: string; avatarUrl?: string }[]>>((acc, ct) => {
    const user = usersMap.get(ct.user_id);
    if (user) {
      const members = acc.get(ct.challenge_id) ?? [];
      members.push({ id: user.uuid, fullName: user.full_name, avatarUrl: user.avatar_url ?? undefined });
      acc.set(ct.challenge_id, members);
    }
    return acc;
  }, new Map());

  const joinedChallengeIds = userChallengeTeams.map((ct) => ct.challenge_id);

  const projectsData = projects
    .map((project) => {
      const projectChallenges = challenges
        .filter((challenge) => challenge.project_id === project.uuid)
        .filter((challenge) =>
          isAdmin ||
          !['draft', 'archived'].includes(challenge.status) ||
          managedProjectIds.includes(challenge.project_id)
        )
        .map((challenge) => ({
          id: challenge.uuid,
          // DB column is NOT NULL (serial), but shared domain types mark it optional.
          // Normalize here so UI types can rely on `index: number`.
          index: challenge.index ?? 0,
          title: challenge.title,
          description: challenge.description || null,
          status: challenge.status,
          type: challenge.type ?? 'code',
          rewardPool: challenge.contribution_points_reward ?? 0,
          contributionsCount: contributionsCountByChallenge.get(challenge.uuid) ?? 0,
          completion: challenge.completion ?? 0,
          teamMembers: teamMembersByChallenge.get(challenge.uuid) ?? [],
          startDate: challenge.start_date?.toISOString() ?? null,
          endDate: challenge.end_date?.toISOString() ?? null,
          recentContributions: recentCountByChallenge.get(challenge.uuid) ?? 0,
          activeContributors: activeContributorsByChallenge.get(challenge.uuid)?.size ?? 0,
          spark: sparkFromContributions(now, contributionsByChallenge.get(challenge.uuid) ?? []),
        }));

      return {
        id: project.uuid,
        title: project.title,
        description: project.description ?? null,
        challenges: projectChallenges,
      } satisfies ProjectWithChallenges;
    });

  return {
    projects: projectsData,
    joinedChallengeIds,
    managedProjectIds,
  };
}

export async function fetchTrendingChallenges(limit: number): Promise<TrendingChallenge[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [contributions, challenges, projects, allChallengeTeams, allUsers] = await Promise.all([
    repositories.contribution.findAll(),
    repositories.challenge.findAll(),
    repositories.project.findAll(),
    repositories.challengeTeam.findAll(),
    repositories.user.findAll(),
  ]);

  const recentCountByChallenge = contributions
    .filter((c) => c.submitted_at >= sevenDaysAgo)
    .reduce<Map<string, number>>((acc, c) => {
      acc.set(c.challenge_id, (acc.get(c.challenge_id) ?? 0) + 1);
      return acc;
    }, new Map());

  const usersMap = new Map(allUsers.map((u) => [u.uuid, u]));
  const projectsMap = new Map(projects.map((p) => [p.uuid, p]));

  const teamMembersByChallenge = allChallengeTeams.reduce<Map<string, { id: string; fullName: string; avatarUrl?: string }[]>>(
    (acc, ct) => {
      const user = usersMap.get(ct.user_id);
      if (user) {
        const members = acc.get(ct.challenge_id) ?? [];
        members.push({ id: user.uuid, fullName: user.full_name, avatarUrl: user.avatar_url ?? undefined });
        acc.set(ct.challenge_id, members);
      }
      return acc;
    },
    new Map()
  );

  const toTrending = (c: (typeof challenges)[number]): TrendingChallenge => {
    const project = projectsMap.get(c.project_id);
    return {
      id: c.uuid,
      index: c.index ?? 0,
      title: c.title,
      type: c.type ?? "code",
      projectName: project?.title ?? "Unknown project",
      description: c.description || null,
      rewardPool: c.contribution_points_reward ?? 0,
      completion: Math.round((c.completion ?? 0) * 100),
      teamMembers: teamMembersByChallenge.get(c.uuid) ?? [],
      startDate: c.start_date?.toISOString() ?? null,
      endDate: c.end_date?.toISOString() ?? null,
      recentContributions: recentCountByChallenge.get(c.uuid) ?? 0,
    };
  };

  const trending = challenges
    .filter((c) => c.status !== "draft" && recentCountByChallenge.has(c.uuid))
    .sort((a, b) => (recentCountByChallenge.get(b.uuid) ?? 0) - (recentCountByChallenge.get(a.uuid) ?? 0))
    .slice(0, limit)
    .map(toTrending);

  if (trending.length > 0) return trending;

  // No activity in the last 7 days → fall back to the most recently created
  // challenges. There is no created_at column, but `index` is a serial, so a
  // higher index means a later creation. Drafts and archived stay hidden.
  return challenges
    .filter((c) => !["draft", "archived"].includes(c.status))
    .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))
    .slice(0, limit)
    .map(toTrending);
}
