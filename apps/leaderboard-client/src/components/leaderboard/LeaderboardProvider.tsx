"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { LeaderboardEntry, ProjectFilter } from "@/lib/types";

interface LeaderboardContextValue {
  projectId: string;
  searchTerm: string;
  setProjectId: (projectId: string) => void;
  setSearchTerm: (term: string) => void;
  entries: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  projects: ProjectFilter[];
}

const LeaderboardContext = createContext<LeaderboardContextValue | undefined>(undefined);

interface LeaderboardProviderProps {
  initialEntries: LeaderboardEntry[];
  initialProjectId: string;
  initialSearchTerm: string;
  projects: ProjectFilter[];
  children: React.ReactNode;
}

async function fetchLeaderboardEntries(projectId: string) {
  const searchParams = new URLSearchParams();
  if (projectId !== "all") {
    searchParams.set("projectId", projectId);
  }

  const response = await fetch(`/api/leaderboard${searchParams.size ? `?${searchParams.toString()}` : ""}`, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Impossible de charger le leaderboard");
  }

  const data = await response.json();
  return data.entries as LeaderboardEntry[];
}

export function LeaderboardProvider({
  initialEntries,
  initialProjectId,
  initialSearchTerm,
  projects,
  children,
}: LeaderboardProviderProps) {
  const [projectId, setProjectIdState] = useState(initialProjectId);
  const [searchTerm, setSearchTermState] = useState(initialSearchTerm);
  const [rawEntries, setRawEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateQuery(params: { projectId?: string; q?: string }) {
    const next = new URLSearchParams(searchParams);
    if (params.projectId !== undefined) {
      if (params.projectId === "all") {
        next.delete("projectId");
      } else {
        next.set("projectId", params.projectId);
      }
    }
    if (params.q !== undefined) {
      if (!params.q) {
        next.delete("q");
      } else {
        next.set("q", params.q);
      }
    }
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  const handleProjectChange = (value: string) => {
    setProjectIdState(value);
    updateQuery({ projectId: value });
    startTransition(async () => {
      setError(null);
      try {
        const entries = await fetchLeaderboardEntries(value);
        setRawEntries(entries);
      } catch (err) {
        console.error(err);
        setError((err as Error).message);
      }
    });
  };

  const handleSearchChange = (term: string) => {
    setSearchTermState(term);
    updateQuery({ q: term });
  };

  const filteredEntries = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return rawEntries;
    return rawEntries.filter((entry) =>
      [entry.displayName, entry.githubUsername]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [rawEntries, searchTerm]);

  const value = useMemo<LeaderboardContextValue>(
    () => ({
      projectId,
      searchTerm,
      setProjectId: handleProjectChange,
      setSearchTerm: handleSearchChange,
      entries: filteredEntries,
      isLoading,
      error,
      projects,
    }),
    [projectId, searchTerm, filteredEntries, isLoading, error, projects]
  );

  return <LeaderboardContext.Provider value={value}>{children}</LeaderboardContext.Provider>;
}

export function useLeaderboardContext() {
  const context = useContext(LeaderboardContext);
  if (!context) {
    throw new Error("useLeaderboardContext must be used within a LeaderboardProvider");
  }
  return context;
}
