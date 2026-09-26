import "server-only";

import { repositories } from "@/lib/db";
import { aggregateUsersByContribution, rankEntries } from "@/lib/leaderboard";
import type {
  HomeLeaderboardEntry,
  HomeOverview,
  HomePodiumEntry,
  HomeStat,
  HomeTrendingChallenge,
} from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const TRENDING_LIMIT = 2;
const REST_LIMIT = 3;

const TYPE_LABELS: Record<string, string> = { code: "Code", ml: "ML", validation: "Validation" };

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

// 7 daily buckets (oldest → newest, today last) over an already-scoped list
// of contributions — used both for the global spark and each challenge's.
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

/**
 * Every read the home page needs — leaderboard podium/rest, global stats,
 * the 7-day activity spark and trending challenges — in one pass over the
 * data, instead of fetchLeaderboard() + fetchTrendingChallenges() each
 * independently re-fetching projects/challenges/contributions/users.
 * Same aggregation idea as /api/challenges/[id]/overview, just server-side
 * since the home page renders fully on the server (no client waterfall to
 * begin with).
 */
export async function fetchHomeOverview(): Promise<HomeOverview> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [projects, challenges, contributions, users, challengeTeams, contributionMembers, sandboxRewards] = await Promise.all([
    repositories.project.findAll(),
    repositories.challenge.findAll(),
    repositories.contribution.findAll(),
    repositories.user.findAll(),
    repositories.challengeTeam.findAll(),
    repositories.contributionMember.findAll(),
    repositories.sandboxReward.findAll(),
  ]);

  const projectsMap = new Map(projects.map((p) => [p.uuid, p]));
  const usersMap = new Map(users.map((u) => [u.uuid, u]));

  // ── Leaderboard: podium (top 3) + next 3, with per-user contribution counts ──
  const aggregated = aggregateUsersByContribution({
    contributions,
    challenges,
    users,
    contributionMembers,
    sandboxRewards,
    projectId: null,
    timePeriod: "all",
  });
  // Même règle que fetchLeaderboard : un compte à 0 CP n'est pas classé, et
  // n'a donc pas à apparaître dans le podium ni dans la suite.
  const ranked = rankEntries(aggregated.filter((a) => a.totalCP > 0));
  const contributorsRanked = ranked.length;

  // Une contribution de groupe compte, et date, pour chacun de ses membres —
  // pas seulement pour celui qui l'a soumise.
  const creditedUsers = new Map<string, string[]>();
  for (const m of contributionMembers) {
    const list = creditedUsers.get(m.contribution_id);
    if (list) list.push(m.user_id);
    else creditedUsers.set(m.contribution_id, [m.user_id]);
  }

  const contributionsCountByUser = new Map<string, number>();
  const earliestContributionByUser = new Map<string, Date>();
  for (const c of contributions) {
    for (const userId of creditedUsers.get(c.uuid) ?? [c.user_id]) {
      // Discussion (Slack signal) contributions aren't a "contribution" in the
      // way a submission is — same exclusion fetchContributorProfile applies.
      if (c.type !== "discussion") {
        contributionsCountByUser.set(userId, (contributionsCountByUser.get(userId) ?? 0) + 1);
      }
      const earliest = earliestContributionByUser.get(userId);
      if (!earliest || c.submitted_at < earliest) earliestContributionByUser.set(userId, c.submitted_at);
    }
  }
  // "Newly ranked" this week = contributors whose very first contribution
  // landed in the last 7 days.
  const newlyRankedThisWeek = ranked.filter((e) => {
    if (e.totalCP <= 0) return false;
    const earliest = earliestContributionByUser.get(e.userId);
    return earliest != null && earliest >= sevenDaysAgo;
  }).length;

  const topCP = ranked[0]?.totalCP ?? 0;
  const podium: HomePodiumEntry[] = ranked.slice(0, 3).map((e) => ({
    rank: e.rank,
    userId: e.userId,
    name: e.displayName,
    bio: e.bio,
    avatarUrl: e.avatarUrl,
    cp: e.totalCP,
    share: topCP > 0 ? e.totalCP / topCP : 0,
    contributionsCount: contributionsCountByUser.get(e.userId) ?? 0,
  }));
  const rest: HomeLeaderboardEntry[] = ranked.slice(3, 3 + REST_LIMIT).map((e) => ({
    rank: e.rank,
    userId: e.userId,
    name: e.displayName,
    bio: e.bio,
    avatarUrl: e.avatarUrl,
    cp: e.totalCP,
  }));

  // ── Global stats + 7-day activity spark ──
  const recentContributions = contributions.filter((c) => c.submitted_at >= sevenDaysAgo);
  // Les CP du sandbox comptent dans la statistique globale parce qu'ils
  // comptent déjà dans le podium juste au-dessus : sans eux, un contributeur
  // pourrait afficher plus de CP que la plateforme n'en aurait distribué.
  const sandboxCpTotal = sandboxRewards.reduce((sum, r) => sum + r.points, 0);
  const sandboxCpWeek = sandboxRewards
    .filter((r) => r.created_at >= sevenDaysAgo)
    .reduce((sum, r) => sum + r.points, 0);
  const cpDistributedTotal =
    contributions.reduce((sum, c) => sum + (c.reward ?? 0), 0) + sandboxCpTotal;
  const cpDistributedWeek =
    recentContributions.reduce((sum, c) => sum + (c.reward ?? 0), 0) + sandboxCpWeek;
  const activeChallenges = challenges.filter((c) => c.status === "active");
  const activeChallengesProjects = new Set(activeChallenges.map((c) => c.project_id)).size;

  const stats: HomeStat[] = [
    {
      value: cpDistributedTotal.toLocaleString("fr-FR"),
      label: "CP distributed",
      delta: cpDistributedWeek > 0 ? `+${cpDistributedWeek.toLocaleString("fr-FR")} / 7d` : "No activity / 7d",
    },
    {
      value: String(contributorsRanked),
      label: "Contributors ranked",
      delta: newlyRankedThisWeek > 0 ? `+${newlyRankedThisWeek} / 7d` : "No new / 7d",
    },
    {
      value: String(activeChallenges.length),
      label: "Challenges open",
      delta: `${activeChallengesProjects} project${activeChallengesProjects !== 1 ? "s" : ""}`,
    },
  ];

  const spark = sparkFromContributions(now, contributions);

  // ── Trending challenges: last 7 days activity, falling back to most recent ──
  const teamMembersByChallenge = new Map<string, { id: string; fullName: string; avatarUrl?: string }[]>();
  for (const ct of challengeTeams) {
    const user = usersMap.get(ct.user_id);
    if (!user) continue;
    const members = teamMembersByChallenge.get(ct.challenge_id) ?? [];
    members.push({ id: user.uuid, fullName: user.full_name, avatarUrl: user.avatar_url ?? undefined });
    teamMembersByChallenge.set(ct.challenge_id, members);
  }

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

  const toTrending = (c: (typeof challenges)[number]): HomeTrendingChallenge => ({
    id: c.uuid,
    slug: c.slug,
    title: c.title,
    type: c.type ?? "code",
    typeLabel: TYPE_LABELS[c.type ?? "code"] ?? "Code",
    status: c.status,
    projectName: projectsMap.get(c.project_id)?.title ?? "Unknown project",
    description: c.description || null,
    rewardPool: c.contribution_points_reward ?? 0,
    completion: Math.round((c.completion ?? 0) * 100),
    teamMembers: teamMembersByChallenge.get(c.uuid) ?? [],
    recentContributions: recentCountByChallenge.get(c.uuid) ?? 0,
    activeContributors: activeContributorsByChallenge.get(c.uuid)?.size ?? 0,
    spark: sparkFromContributions(now, contributionsByChallenge.get(c.uuid) ?? []),
    coverImageUrl: c.cover_image_url ?? null,
  });

  // Both paths below share this: a draft is not published yet, and 'completed'
  // ou 'archived' est fermé — le même couple que `isOpen()` dans joinGate.ts,
  // qui décide si on propose encore de rejoindre. Mettre en avant un challenge
  // qu'on ne peut plus rejoindre n'a pas de sens. Recent activity on a closed
  // one — a late evaluation landing, say — used to be enough to surface it
  // here, which is precisely when it must not appear.
  const isTrendable = (c: (typeof challenges)[number]) =>
    !["draft", "completed", "archived"].includes(c.status);

  // What actually moved in the last 7 days, busiest first.
  const movingNow = challenges
    .filter((c) => isTrendable(c) && recentCountByChallenge.has(c.uuid))
    .sort((a, b) => (recentCountByChallenge.get(b.uuid) ?? 0) - (recentCountByChallenge.get(a.uuid) ?? 0));

  // Topped up with the most recently created challenges, not replaced by them.
  // A quiet week used to be the only case this covered, but the section is a
  // two-card grid: with a single challenge active it rendered one card and an
  // empty column. Activity still wins the first slots; recency only fills what
  // is left. There is no created_at column, but `index` is a serial, so a
  // higher index means a later creation.
  const alreadyPicked = new Set(movingNow.map((c) => c.uuid));
  const mostRecent = challenges
    .filter((c) => isTrendable(c) && !alreadyPicked.has(c.uuid))
    .sort((a, b) => (b.index ?? 0) - (a.index ?? 0));

  const trendingChallenges = [...movingNow, ...mostRecent]
    .slice(0, TRENDING_LIMIT)
    .map(toTrending);

  return { stats, spark, podium, rest, contributorsRanked, trendingChallenges };
}
