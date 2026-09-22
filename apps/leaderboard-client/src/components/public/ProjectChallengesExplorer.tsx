'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import type { ProjectWithChallenges, TeamMember } from "@/lib/types";
import { ChallengeCard } from "@/components/public/ChallengeCard";
import { ChallengesFiltersBar, type StatusFilter } from "@/components/public/ChallengesFiltersBar";
import { ChallengesHero } from "@/components/public/ChallengesHero";
import { CreateChallengeDrawer } from "@/components/admin/CreateChallengeDrawer";
import { ManagerRolePopup } from "@/components/challenges/ManagerRolePopup";
import { challengeManagePath } from "@/lib/paths";
import { formatCP } from "@/lib/formatters";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { ArrowTinyIcon } from "@/components/vitrine/SearchIcon";

import "@/components/vitrine/vitrine.css";
import "./challenges-vitrine.css";

interface ProjectChallengesExplorerProps {
  projects: ProjectWithChallenges[];
  joinedChallengeIds: string[];
  isAdmin?: boolean;
  managedProjectIds?: string[];
}

type FlatChallenge = {
  id: string;
  slug: string;
  index: number;
  title: string;
  status: string;
  type: string;
  projectName: string;
  projectId: string;
  description: string | null;
  rewardPool: number;
  completion: number;
  teamMembers: TeamMember[];
  startDate: string | null;
  endDate: string | null;
  recentContributions: number;
  activeContributors: number;
  spark: number[];
  coverImageUrl: string | null;
};

/**
 * Le listing `/challenges`, d'après `Challenges Redesign Vitrine.dc.html`.
 *
 * Deux écarts assumés par rapport à la maquette, demandés avec elle :
 *  - le menu déroulant des projets disparaît ;
 *  - la recherche porte aussi sur les projets, et ceux qui répondent
 *    s'affichent au-dessus de la grille. En choisir un restreint la grille à
 *    ses challenges — c'est ce qui remplace le menu déroulant.
 */
export function ProjectChallengesExplorer({
  projects,
  joinedChallengeIds,
  isAdmin = false,
  managedProjectIds = [],
}: ProjectChallengesExplorerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [managerDrawerOpen, setManagerDrawerOpen] = useState(false);
  const [popup, setPopup] = useState<{ x: number; y: number; challengeId: string; challengeSlug: string } | null>(null);

  const joinedSet = useMemo(() => new Set(joinedChallengeIds), [joinedChallengeIds]);
  const managedSet = useMemo(() => new Set(managedProjectIds), [managedProjectIds]);

  const allChallenges = useMemo<FlatChallenge[]>(() => {
    return projects
      .flatMap((project) =>
        project.challenges.map((challenge) => ({
          id: challenge.id,
          slug: challenge.slug,
          index: challenge.index,
          title: challenge.title,
          status: challenge.status,
          type: challenge.type,
          projectName: project.title,
          projectId: project.id,
          description: challenge.description,
          rewardPool: challenge.rewardPool,
          completion: Math.round(challenge.completion * 100),
          teamMembers: challenge.teamMembers,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          recentContributions: challenge.recentContributions,
          activeContributors: challenge.activeContributors,
          spark: challenge.spark,
          coverImageUrl: challenge.coverImageUrl,
        }))
      )
      // Most recent first; undated challenges have no place on that axis, so
      // they sink to the bottom rather than sorting as NaN.
      .sort((a, b) => {
        if (!a.startDate) return b.startDate ? 1 : 0;
        if (!b.startDate) return -1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });
  }, [projects]);

  const needle = searchTerm.trim().toLowerCase();

  const managedProjectOptions = useMemo(
    () => projects.filter((project) => managedSet.has(project.id)).map((project) => ({ id: project.id, name: project.title })),
    [projects, managedSet],
  );

  /**
   * Les projets que la recherche fait remonter. Rien tant qu'on ne cherche
   * pas : la maquette ne montre que des challenges au repos.
   */
  const matchingProjects = useMemo(() => {
    if (!needle) return [];
    return projects
      .filter(
        (project) =>
          project.title.toLowerCase().includes(needle) ||
          (project.description ?? "").toLowerCase().includes(needle),
      )
      .map((project) => {
        const open = project.challenges.filter((challenge) => challenge.status === "active");
        return {
          id: project.id,
          name: project.title,
          description: project.description,
          challengeCount: project.challenges.length,
          openCP: open.reduce((sum, challenge) => sum + challenge.rewardPool, 0),
        };
      });
  }, [projects, needle]);

  /** La recherche, seule — c'est sur elle que se comptent les pills. */
  const searchPool = useMemo(() => {
    return allChallenges.filter((challenge) => {
      const matchesSearch =
        !needle ||
        challenge.title.toLowerCase().includes(needle) ||
        challenge.projectName.toLowerCase().includes(needle);
      const matchesProject = selectedProjectId === "all" || challenge.projectId === selectedProjectId;
      return matchesSearch && matchesProject;
    });
  }, [allChallenges, needle, selectedProjectId]);

  const filteredChallenges = useMemo(() => {
    return searchPool.filter((challenge) =>
      statusFilter === "all"
        ? true
        : statusFilter === "manage"
          ? managedSet.has(challenge.projectId)
          : challenge.status === statusFilter,
    );
  }, [searchPool, statusFilter, managedSet]);

  const pills = useMemo(() => {
    const count = (predicate: (challenge: FlatChallenge) => boolean) => searchPool.filter(predicate).length;
    return [
      { value: "active" as StatusFilter, label: "Active", count: count((c) => c.status === "active") },
      { value: "completed" as StatusFilter, label: "Completed", count: count((c) => c.status === "completed") },
      { value: "all" as StatusFilter, label: "All", count: searchPool.length },
      ...(isAdmin
        ? [{ value: "draft" as StatusFilter, label: "Draft", count: count((c) => c.status === "draft") }]
        : []),
      ...(managedProjectIds.length > 0
        ? [{ value: "manage" as StatusFilter, label: "Manage", count: count((c) => managedSet.has(c.projectId)) }]
        : []),
    ];
  }, [searchPool, isAdmin, managedProjectIds.length, managedSet]);

  const projectOptions = useMemo(
    () => projects.map((project) => ({ id: project.id, name: project.title })),
    [projects],
  );

  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.id === selectedProjectId) ?? null,
    [projectOptions, selectedProjectId],
  );

  const heroStats = useMemo(() => {
    const active = allChallenges.filter((challenge) => challenge.status === "active");
    const totalCP = active.reduce((sum, challenge) => sum + challenge.rewardPool, 0);
    return [
      { value: String(active.length), label: "Open now" },
      { value: formatCP(totalCP), label: "CP in play" },
      { value: String(projects.length), label: "Projects" },
    ];
  }, [allChallenges, projects]);

  const canCreate = isAdmin || (statusFilter === "manage" && managedProjectIds.length > 0);

  return (
    <>
    <div className={`vitrine v-challenges ${vitrineFontVars}`}>
      <div className="v-main v-ch-main">
        <ChallengesHero stats={heroStats} />

        <ChallengesFiltersBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          pills={pills}
          resultLabel={`${filteredChallenges.length} challenge${filteredChallenges.length === 1 ? "" : "s"} shown`}
          selectedProject={selectedProject}
          onClearProject={() => setSelectedProjectId("all")}
          onCreate={canCreate ? () => (isAdmin ? setDrawerOpen(true) : setManagerDrawerOpen(true)) : undefined}
        />

        {matchingProjects.length > 0 && (
          <section className="v-projects">
            <div className="v-projects-head">
              <span className="v-projects-title">Projects</span>
              <span className="v-ch-result">
                {matchingProjects.length} project{matchingProjects.length === 1 ? "" : "s"} match
              </span>
            </div>
            <div className="v-projects-grid">
              {matchingProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="v-project"
                  data-on={selectedProjectId === project.id ? "true" : "false"}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    // La recherche a servi : elle s'efface, la liste des autres
                    // projets disparaît, et le projet retenu reste en pastille.
                    setSearchTerm("");
                  }}
                >
                  <span className="v-project-go">
                    <ArrowTinyIcon />
                  </span>
                  <span className="v-project-name">{project.name}</span>
                  {project.description && (
                    <span className="v-project-desc">{project.description}</span>
                  )}
                  <span className="v-project-meta">
                    {project.challengeCount} challenge{project.challengeCount === 1 ? "" : "s"}
                    {project.openCP > 0 ? ` · ${formatCP(project.openCP)} CP in play` : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {filteredChallenges.length === 0 ? (
          <div className="v-ch-empty">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803M10.5 7.5v6m3-3h-6"
              />
            </svg>
            <span>No challenge matches this filter.</span>
          </div>
        ) : (
          <div className="v-ch-grid">
            {filteredChallenges.map((challenge, i) => (
              <ChallengeCard
                key={challenge.id}
                index={i}
                challengeId={challenge.id}
                challengeSlug={challenge.slug}
                challengeTitle={challenge.title}
                challengeType={challenge.type}
                challengeStatus={challenge.status}
                projectName={challenge.projectName}
                description={challenge.description}
                rewardPool={challenge.rewardPool}
                completion={challenge.completion}
                coverImageUrl={challenge.coverImageUrl}
                isMember={joinedSet.has(challenge.id)}
                isAdmin={isAdmin}
                teamMembers={challenge.teamMembers}
                recentContributions={challenge.recentContributions}
                spark={challenge.spark}
                onCardClick={
                  isAdmin || managedSet.has(challenge.projectId)
                    ? (event) =>
                        setPopup({
                          x: event.clientX,
                          y: event.clientY,
                          challengeId: challenge.id,
                          challengeSlug: challenge.slug,
                        })
                    : undefined
                }
              />
            ))}
          </div>
        )}

        <div className="v-strip v-ch-strip">
          <div className="v-strip-text">
            <span className="v-strip-title">Nothing here fits your skills?</span>
            <span className="v-strip-sub">
              Propose a challenge — projects are opened by contributors, not by a committee.
            </span>
          </div>
          <Link href="/sandbox" className="v-strip-cta">
            Propose a challenge
          </Link>
        </div>
      </div>
    </div>

    {/* ── Ce qui flotte au-dessus de la page, monté hors de `.vitrine` ──
        Le tiroir et le popup portent l'habillage du Lab, en utilitaires
        Tailwind. Le réarmement d'éléments de `vitrine.css` n'est dans aucune
        couche (`@layer`) et l'emporte donc sur eux quelle que soit sa
        spécificité : rendus à l'intérieur, leurs boutons perdaient padding,
        fond et bordure. `CreateSandboxModal` est dans l'autre cas — il porte
        sa propre racine `.vitrine`, et reste donc monté dans la sienne. ── */}

    {/* Admin drawer */}
    {isAdmin && (
      <CreateChallengeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projects={projectOptions}
        onCreated={(created) => router.push(`/admin/challenges/${created.uuid}`)}
      />
    )}

    {/* Manager drawer */}
    {!isAdmin && managedProjectIds.length > 0 && (
      <CreateChallengeDrawer
        open={managerDrawerOpen}
        onClose={() => setManagerDrawerOpen(false)}
        projects={managedProjectOptions}
        onCreated={(created) => router.push(challengeManagePath(created.slug))}
      />
    )}

    {/* Manager role popup */}
    {popup && (
      <ManagerRolePopup
        x={popup.x}
        y={popup.y}
        challengeId={popup.challengeId}
        challengeSlug={popup.challengeSlug}
        isAdmin={isAdmin}
        onClose={() => setPopup(null)}
      />
    )}
    </>
  );
}
