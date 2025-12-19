import { ProjectChallengesExplorer } from "@/components/public/ProjectChallengesExplorer";
import { fetchProjectsWithChallenges } from "@/lib/server/publicPages";
import { getSessionUser } from "@/lib/auth";
//import { FiltersBar } from "@/components/leaderboard/FiltersBar";

export const metadata = {
  title: "Challenges publics",
  description: "Découvrez les projets en cours et les challenges ouverts du Lab",
};

export default async function PublicChallengesPage() {
  const session = await getSessionUser();
  const { projects, joinedChallengeIds } = await fetchProjectsWithChallenges(session?.id);

  return (
    <div className="space-y-6">
      <ProjectChallengesExplorer projects={projects} joinedChallengeIds={joinedChallengeIds} />
    </div>
  );
}
