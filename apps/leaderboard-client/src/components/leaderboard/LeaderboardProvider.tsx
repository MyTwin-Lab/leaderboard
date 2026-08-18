"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { LeaderboardEntry, ProjectFilter } from "@/lib/types";

interface LeaderboardContextValue {
  projectId: string;
  searchTerm: string;
  setProjectId: (projectId: string) => void;
  setSearchTerm: (term: string) => void;
  /** Project-scoped, unranked-zero-CP-excluded, NOT search-filtered — powers the hero stats. */
  scoredEntries: LeaderboardEntry[];
  /** Search-filtered on top of scoredEntries — powers the podium + list. */
  entries: LeaderboardEntry[];
  /** Top 3 of `entries`, only while there's no active search (mirrors the design's "Podium" section). */
  podium: LeaderboardEntry[];
  /** Ranks 4+ when the podium is shown, otherwise every entry. */
  rest: LeaderboardEntry[];
  hasPodium: boolean;
  /** Whether the "Other contributors" list + CTA banner should render at all. */
  showList: boolean;
  isLoading: boolean;
  error: string | null;
  projects: ProjectFilter[];
  currentUserId?: string;
}

const LeaderboardContext = createContext<LeaderboardContextValue | undefined>(undefined);

interface LeaderboardProviderProps {
  initialEntries: LeaderboardEntry[];
  initialProjectId: string;
  initialSearchTerm: string;
  projects: ProjectFilter[];
  currentUserId?: string;
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
  currentUserId,
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

  // Contributors with 0 CP aren't "ranked" yet — exclude them from the
  // leaderboard's stats/podium/list, same as the home page's overview.
  const scoredEntries = useMemo(
    () => rawEntries.filter((entry) => entry.totalCP > 0),
    [rawEntries]
  );

  const filteredEntries = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return scoredEntries;
    return scoredEntries.filter((entry) =>
      [entry.displayName, entry.githubUsername]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [scoredEntries, searchTerm]);

  const hasPodium = searchTerm.trim().length === 0 && filteredEntries.length > 0;
  const { podium, rest } = useMemo(
    () => ({
      podium: hasPodium ? filteredEntries.slice(0, 3) : [],
      rest: hasPodium ? filteredEntries.slice(3) : filteredEntries,
    }),
    [hasPodium, filteredEntries]
  );
  const showList = rest.length > 0 || filteredEntries.length === 0;

  const value = useMemo<LeaderboardContextValue>(
    () => ({
      projectId,
      searchTerm,
      setProjectId: handleProjectChange,
      setSearchTerm: handleSearchChange,
      scoredEntries,
      entries: filteredEntries,
      podium,
      rest,
      hasPodium,
      showList,
      isLoading,
      error,
      projects,
      currentUserId,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, searchTerm, scoredEntries, filteredEntries, podium, rest, hasPodium, showList, isLoading, error, projects, currentUserId]
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
