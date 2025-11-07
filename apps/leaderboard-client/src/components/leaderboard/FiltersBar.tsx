"use client";

import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";

export function FiltersBar() {
  const { projectId, searchTerm, setProjectId, setSearchTerm, projects, isLoading } = useLeaderboardContext();

  return (
    <div className="flex flex-col gap-130 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <label className="flex flex-col text-sm text-white/60">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search contributors..."
            className="w-full rounded-md border border-white/10 bg-white/2 px-4 py-2 text-base text-white placeholder:text-white/80 focus:border-primary-200 focus:outline-none"
            disabled={isLoading}
          />
        </label>
      </div>

      <div className="flex flex-1 gap-4">
        <label className="flex flex-1 flex-col text-sm text-white/60">
          <div className="relative">
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="w-full appearance-none rounded-md border border-white/10 bg-white/10 px-4 py-2 text-base text-white shadow-sm transition focus:border-primary-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
            >
              {projects.map((project) => (
                <option key={project.id ?? "all"} value={project.id ?? "all"} style={{ backgroundColor: "#0B1E33", color: "#F8FBFF" }}>
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

<style jsx>{`
  select option {
    background-color: rgba(8, 47, 73, 0.95);
    color: #f8fbff;
  }
`}</style>
