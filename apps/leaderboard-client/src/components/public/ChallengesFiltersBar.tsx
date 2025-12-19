"use client";

import { useState } from "react";

interface Project {
  id: string;
  name: string;
}

interface ChallengesFiltersBarProps {
  projects: Project[];
  onSearchChange: (searchTerm: string) => void;
  onProjectChange: (projectId: string) => void;
}

export function ChallengesFiltersBar({
  projects,
  onSearchChange,
  onProjectChange,
}: ChallengesFiltersBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [projectId, setProjectId] = useState("all");

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onSearchChange(value);
  };

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    onProjectChange(value);
  };

  const projectOptions = [{ id: "all", name: "All Projects" }, ...projects];

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="w-full sm:flex-1 sm:max-w-[300px]">
        <label className="flex flex-col text-sm text-white/60">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search challenges..."
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-brandCP focus:outline-none sm:px-4 sm:text-base"
          />
        </label>
      </div>

      <div className="w-full sm:w-auto sm:max-w-[200px]">
        <label className="flex flex-col text-sm text-white/60">
          <div className="relative">
            <select
              value={projectId}
              onChange={(event) => handleProjectChange(event.target.value)}
              className="w-full appearance-none rounded-md border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white shadow-sm transition focus:border-brandCP focus:outline-none sm:px-4 sm:text-base"
            >
              {projectOptions.map((project) => (
                <option
                  key={project.id}
                  value={project.id}
                  style={{ backgroundColor: "#0B1E33", color: "#F8FBFF" }}
                >
                  {project.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/60">
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.17l3.71-2.94a.75.75 0 111.04 1.08l-4.23 3.36a.75.75 0 01-.94 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}
