"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { LeaderboardEntry, ProjectFilter } from "@/lib/types";

export type TimePeriod = "all" | "month" | "week";

interface LeaderboardContextValue {
  projectId: string;
  searchTerm: string;
  timePeriod: TimePeriod;
  setProjectId: (projectId: string) => void;
  setSearchTerm: (term: string) => void;
  setTimePeriod: (period: TimePeriod) => void;
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

async function fetchLeaderboardEntries(projectId: string, timePeriod: TimePeriod) {
  const searchParams = new URLSearchParams();
  if (projectId !== "all") {
    searchParams.set("projectId", projectId);
  }
  if (timePeriod !== "all") {
    searchParams.set("timePeriod", timePeriod);
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
  const [timePeriod, setTimePeriodState] = useState<TimePeriod>("all");
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
        const entries = await fetchLeaderboardEntries(value, timePeriod);
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

  const handleTimePeriodChange = (period: TimePeriod) => {
    setTimePeriodState(period);
    startTransition(async () => {
      setError(null);
      try {
        const entries = await fetchLeaderboardEntries(projectId, period);
        setRawEntries(entries);
      } catch (err) {
        console.error(err);
        setError((err as Error).message);
      }
    });
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
      timePeriod,
      setProjectId: handleProjectChange,
      setSearchTerm: handleSearchChange,
      setTimePeriod: handleTimePeriodChange,
      entries: filteredEntries,
      isLoading,
      error,
      projects,
    }),
    [projectId, searchTerm, timePeriod, filteredEntries, isLoading, error, projects]
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
