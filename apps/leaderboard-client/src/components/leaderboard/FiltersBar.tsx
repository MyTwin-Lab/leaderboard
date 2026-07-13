"use client";

import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";
import { SelectDropdown } from "@/components/ui/SelectDropdown";

export function FiltersBar() {
  const { projectId, searchTerm, setProjectId, setSearchTerm, projects, isLoading } = useLeaderboardContext();

  const projectOptions = projects.map((p) => ({
    value: p.id ?? "all",
    label: p.name,
  }));

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-30"
          style={{ color: "var(--foreground)" }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search contributors…"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm transition-colors focus:border-brandCP/60 focus:bg-white/8 focus:outline-none disabled:opacity-50"
          style={{ color: "var(--foreground)" }}
          disabled={isLoading}
        />
      </div>

      {/* Project filter */}
      <SelectDropdown
        options={projectOptions}
        value={projectId ?? "all"}
        onChange={setProjectId}
        disabled={isLoading}
        className="sm:w-[180px]"
      />
    </div>
  );
}
