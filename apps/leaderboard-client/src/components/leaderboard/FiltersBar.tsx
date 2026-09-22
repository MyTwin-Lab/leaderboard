"use client";

import { useMemo } from "react";

import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";
import { ArrowTinyIcon, SearchIcon } from "@/components/vitrine/SearchIcon";

/**
 * La recherche du classement, dans la même grammaire que celle des challenges :
 * une seule gélule pleine largeur, le filet au-dessus, et pas de menu déroulant.
 *
 * Les projets se trouvent par la recherche : ceux qui répondent s'affichent
 * sous le champ, et en choisir un restreint le classement à ses contributions.
 * Le champ se vide alors — les autres projets disparaissent, et le projet
 * retenu reste en pastille, relâchable.
 */
export function FiltersBar() {
  const { projectId, searchTerm, setProjectId, setSearchTerm, projects, isLoading } =
    useLeaderboardContext();

  const needle = searchTerm.trim().toLowerCase();

  const matchingProjects = useMemo(() => {
    if (!needle) return [];
    return projects
      .filter((project) => project.id !== null && project.name.toLowerCase().includes(needle))
      .map((project) => ({ id: project.id as string, name: project.name }));
  }, [projects, needle]);

  const selectedProject = projects.find(
    (project) => project.id !== null && project.id === projectId,
  );

  return (
    <section className="v-lb-filters">
      <div className="v-lb-filters-row">
        <div className="v-search">
          <span className="v-search-icon">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search contributors and projects…"
            disabled={isLoading}
          />
        </div>
      </div>

      {selectedProject && (
        <div className="v-pills">
          <button type="button" className="v-chip" onClick={() => setProjectId("all")}>
            {selectedProject.name}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {matchingProjects.length > 0 && (
        <div className="v-projects">
          <div className="v-projects-head">
            <span className="v-projects-title">Projects</span>
          </div>
          <div className="v-projects-grid">
            {matchingProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="v-project"
                data-on={projectId === project.id ? "true" : "false"}
                onClick={() => {
                  setProjectId(project.id);
                  // La recherche a servi : elle s'efface, la liste des autres
                  // projets disparaît, et le projet retenu reste en pastille.
                  setSearchTerm("");
                }}
              >
                <span className="v-project-go">
                  <ArrowTinyIcon />
                </span>
                <span className="v-project-name">{project.name}</span>
                <span className="v-project-meta">See its ranking</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
