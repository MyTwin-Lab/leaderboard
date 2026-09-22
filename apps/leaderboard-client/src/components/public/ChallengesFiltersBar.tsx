"use client";

import { Plus } from "lucide-react";

import { SearchIcon } from "@/components/vitrine/SearchIcon";

export type StatusFilter = "all" | "active" | "completed" | "draft" | "manage";

export interface StatusPill {
  value: StatusFilter;
  label: string;
  count: number;
}

interface SelectedProject {
  id: string;
  name: string;
}

interface ChallengesFiltersBarProps {
  searchTerm: string;
  onSearchChange: (searchTerm: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  pills: StatusPill[];
  resultLabel: string;
  /** Le projet retenu depuis la recherche, relâchable. */
  selectedProject: SelectedProject | null;
  onClearProject: () => void;
  /** Le bouton « New challenge » d'un admin ou d'un manager. */
  onCreate?: () => void;
}

/**
 * La barre de filtres de la maquette — sans le menu déroulant des projets :
 * les projets se trouvent désormais par la recherche (voir
 * `ProjectChallengesExplorer`), et le projet retenu s'affiche ici en pastille.
 */
export function ChallengesFiltersBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  pills,
  resultLabel,
  selectedProject,
  onClearProject,
  onCreate,
}: ChallengesFiltersBarProps) {
  return (
    <div className="v-ch-filters">
      <div className="v-ch-filters-row">
        <div className="v-search">
          <span className="v-search-icon">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search challenges and projects…"
          />
        </div>

        {onCreate && (
          <button type="button" className="v-ch-new" onClick={onCreate}>
            <Plus />
            New challenge
          </button>
        )}
      </div>

      <div className="v-ch-pills-row">
        <div className="v-pills">
          {pills.map((pill) => (
            <button
              key={pill.value}
              type="button"
              className="v-pill"
              data-on={statusFilter === pill.value ? "true" : "false"}
              onClick={() => onStatusChange(pill.value)}
            >
              {pill.label}
              <span className="v-pill-count">{pill.count}</span>
            </button>
          ))}

          {selectedProject && (
            <button type="button" className="v-chip" onClick={onClearProject}>
              {selectedProject.name}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <span className="v-ch-result">{resultLabel}</span>
      </div>
    </div>
  );
}
