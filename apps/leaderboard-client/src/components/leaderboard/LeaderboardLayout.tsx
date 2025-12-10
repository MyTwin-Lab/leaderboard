import type { LeaderboardEntry, ProjectFilter } from "@/lib/types";
import { LeaderboardProvider } from "@/components/leaderboard/LeaderboardProvider";
import { FiltersBar } from "@/components/leaderboard/FiltersBar";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";

interface LeaderboardLayoutProps {
  initialEntries: LeaderboardEntry[];
  initialProjectId: string;
  initialSearchTerm: string;
  projects: ProjectFilter[];
}

export function LeaderboardLayout({
  initialEntries,
  initialProjectId,
  initialSearchTerm,
  projects,
}: LeaderboardLayoutProps) {
  return (
    <LeaderboardProvider
      initialEntries={initialEntries}
      initialProjectId={initialProjectId}
      initialSearchTerm={initialSearchTerm}
      projects={projects}
    >
      <div className="space-y-1">
        <FiltersBar />
        <LeaderboardTable initialEntries={initialEntries} />
      </div>
    </LeaderboardProvider>
  );
}
