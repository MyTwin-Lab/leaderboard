"use client";

import { useState } from "react";
import { SelectDropdown } from "@/components/ui/SelectDropdown";

interface Project {
  id: string;
  name: string;
}

type StatusFilter = 'all' | 'active' | 'completed' | 'draft' | 'manage';

interface ChallengesFiltersBarProps {
  projects: Project[];
  onSearchChange: (searchTerm: string) => void;
  onProjectChange: (projectId: string) => void;
  onStatusChange: (status: StatusFilter) => void;
  isAdmin?: boolean;
  hasManaged?: boolean;
  rightSlot?: React.ReactNode;
}

export function ChallengesFiltersBar({
  projects,
  onSearchChange,
  onProjectChange,
  onStatusChange,
  isAdmin = false,
  hasManaged = false,
  rightSlot,
}: ChallengesFiltersBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onSearchChange(value);
  };

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    onProjectChange(value);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    onStatusChange(value);
  };

  const projectOptions = [
    { value: "all", label: "All Projects" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    ...(isAdmin ? [{ value: 'draft' as StatusFilter, label: 'Draft' }] : []),
    ...(hasManaged ? [{ value: 'manage' as StatusFilter, label: 'Manage' }] : []),
  ];

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Row 1: search + project filter + right slot */}
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
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search challenges…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm transition-colors focus:border-brandCP/60 focus:bg-white/8 focus:outline-none"
            style={{ color: "var(--foreground)" }}
          />
        </div>

        {/* Project filter */}
        <SelectDropdown
          options={projectOptions}
          value={projectId}
          onChange={handleProjectChange}
          className="sm:w-[180px]"
        />

        {/* Right slot */}
        {rightSlot}
      </div>

      {/* Row 2: status pills */}
      <div className="flex items-center gap-1.5">
        {statusOptions.map(({ value, label }) => {
          const isActive = statusFilter === value;
          const isDraft = value === 'draft';
          return (
            <button
              key={value}
              onClick={() => handleStatusChange(value)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? isDraft
                    ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                    : value === 'manage'
                      ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                      : 'bg-brandCP/20 text-brandCP shadow-[0_0_10px_rgba(10,247,193,0.12)]'
                  : 'hover:bg-white/[0.05]'
              }`}
              style={!isActive ? { color: "var(--foreground)", opacity: 0.4 } : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
