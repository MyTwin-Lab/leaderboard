import "server-only";

import { repositories } from "@/lib/db";
import type { ProjectWithChallenges } from "@/lib/types";

export type ChallengesPageData = {
  projects: ProjectWithChallenges[];
  joinedChallengeIds: string[];
};

export async function fetchProjectsWithChallenges(userId?: string | null): Promise<ChallengesPageData> {
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

  // Group team members by challenge
  const teamMembersByChallenge = allChallengeTeams.reduce<Map<string, { id: string; fullName: string }[]>>((acc, ct) => {
    const user = usersMap.get(ct.user_id);
    if (user) {
      const members = acc.get(ct.challenge_id) ?? [];
      members.push({ id: user.uuid, fullName: user.full_name });
      acc.set(ct.challenge_id, members);
    }
    return acc;
  }, new Map());

  const joinedChallengeIds = userChallengeTeams.map((ct) => ct.challenge_id);

  const projectsData = projects
    .map((project) => {
      const projectChallenges = challenges
        .filter((challenge) => challenge.project_id === project.uuid)
        .map((challenge) => ({
          id: challenge.uuid,
          title: challenge.title,
          rewardPool: challenge.contribution_points_reward ?? 0,
          contributionsCount: contributionsCountByChallenge.get(challenge.uuid) ?? 0,
          completion: challenge.completion ?? 0,
          teamMembers: teamMembersByChallenge.get(challenge.uuid) ?? [],
          startDate: challenge.start_date.toISOString(),
          endDate: challenge.end_date.toISOString(),
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

      return {
        id: project.uuid,
        title: project.title,
        description: project.description ?? null,
        challenges: projectChallenges,
      } satisfies ProjectWithChallenges;
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    projects: projectsData,
    joinedChallengeIds,
  };
}
