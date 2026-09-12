import type {
  Contribution,
  ContributionMember,
  Challenge,
  SandboxReward,
  User,
  Project,
} from "../../../../packages/database-service/domain/entities.js";

import type { LeaderboardEntry, ProjectFilter } from "./types";

export type AggregatedUser = {
  user: User;
  totalCP: number;
  contributionsCount: number;
};

export function aggregateUsersByContribution({
  contributions,
  challenges,
  users,
  contributionMembers,
  sandboxRewards,
  projectId,
  timePeriod,
}: {
  contributions: Contribution[];
  challenges: Challenge[];
  users: User[];
  /**
   * Parts de CP des contributions de groupe. Une contribution absente d'ici
   * est une contribution solo : tout son reward va à `user_id`, comme avant.
   */
  contributionMembers?: ContributionMember[];
  /**
   * Ledger des CP du sandbox (`sandbox_rewards`), séparé de `reward_entries`
   * parce qu'un sandbox n'a ni challenge ni contribution. C'est le seul point
   * d'injection de ces CP dans le classement : rangs et écarts en découlent.
   */
  sandboxRewards?: SandboxReward[];
  projectId?: string | null;
  timePeriod?: "all" | "month" | "week";
}): AggregatedUser[] {
  const challengeById = new Map<string, Challenge>(
    challenges.map((challenge) => [challenge.uuid, challenge])
  );
  const userById = new Map<string, User>(users.map((user) => [user.uuid, user]));
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();

  const membersByContribution = new Map<string, ContributionMember[]>();
  for (const member of contributionMembers ?? []) {
    const list = membersByContribution.get(member.contribution_id);
    if (list) list.push(member);
    else membersByContribution.set(member.contribution_id, [member]);
  }

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

    // Une contribution de groupe se répartit entre ses membres : c'est
    // `share_cp` qui fait foi, jamais `contributions.reward` (le total groupe).
    // Elle compte pour une contribution chez chacun d'eux — sans ça un
    // co-membre afficherait 0 contribution tout en ayant des CP.
    const members = membersByContribution.get(contribution.uuid);
    const credited: Array<{ userId: string; cp: number }> = members?.length
      ? members.map((m) => ({ userId: m.user_id, cp: m.share_cp }))
      : [{ userId: contribution.user_id, cp: contribution.reward ?? 0 }];

    for (const { userId, cp } of credited) {
      if (!userById.has(userId)) continue;
      totals.set(userId, (totals.get(userId) ?? 0) + cp);
      // Discussion (Slack signal) contributions aren't a "contribution" in the
      // way a submission is — same exclusion fetchHomeOverview()/fetchContributorProfile() apply.
      if (contribution.type !== "discussion") {
        counts.set(userId, (counts.get(userId) ?? 0) + 1);
      }
    }
  }

  // CP du sandbox : ils s'ajoutent aux totaux **sans toucher `counts`**, le
  // traitement déjà réservé aux contributions `discussion`. Un palier de stars
  // franchi paie une proposition, ce n'est pas une contribution de plus.
  //
  // Un filtre projet les écarte en bloc : un sandbox n'a pas de projet, donc
  // aucun ne peut appartenir à celui qu'on regarde. Les inclure gonflerait le
  // total d'un contributeur avec des CP gagnés hors du périmètre demandé.
  if (!projectId) {
    for (const reward of sandboxRewards ?? []) {
      // `user_id` est l'auteur au moment du paiement, dénormalisé : pas de
      // jointure ici. Un utilisateur absent du jeu de données (filtré en
      // amont, ou supprimé) est ignoré, comme pour une contribution.
      if (!userById.has(reward.user_id)) continue;
      if (dateThreshold && reward.created_at < dateThreshold) continue;
      totals.set(reward.user_id, (totals.get(reward.user_id) ?? 0) + reward.points);
    }
  }

  // Include all users, even those with 0 CP
  return Array.from(userById.values()).map((user) => ({
    user,
    totalCP: totals.get(user.uuid) ?? 0,
    contributionsCount: counts.get(user.uuid) ?? 0,
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
    avatarUrl: entry.user.avatar_url ?? undefined,
    totalCP: entry.totalCP,
    contributionsCount: entry.contributionsCount,
  }));
}
