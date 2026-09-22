import { ProjectChallengesExplorer } from "@/components/public/ProjectChallengesExplorer";
import { fetchProjectsWithChallenges } from "@/lib/server/publicPages";
import { getSessionUser } from "@/lib/auth";
import { repositories } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
//import { FiltersBar } from "@/components/leaderboard/FiltersBar";

export const metadata = pageMetadata({
  title: "Open Health Innovation Challenges",
  description:
    "Real health problems turned into open challenges: join one, contribute code, datasets or models, get evaluated on clear criteria and earn contribution points.",
  path: "/challenges",
});

export default async function PublicChallengesPage() {
  const session = await getSessionUser();
  const isAdmin = session?.role === 'admin';
  const managedProjects = session ? await repositories.project.findByManagerId(session.id) : [];
  const managedProjectIds = managedProjects.map(p => p.uuid);
  const { projects, joinedChallengeIds } = await fetchProjectsWithChallenges(session?.id, isAdmin, managedProjectIds);

  // Le listing porte sa propre mise en page, d'après la maquette : bandeau de
  // bas de page compris (voir `ProjectChallengesExplorer`).
  return (
    <ProjectChallengesExplorer
      projects={projects}
      joinedChallengeIds={joinedChallengeIds}
      isAdmin={isAdmin}
      managedProjectIds={managedProjectIds}
    />
  );
}
