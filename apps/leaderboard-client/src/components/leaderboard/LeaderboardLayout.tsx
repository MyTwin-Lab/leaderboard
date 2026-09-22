import type { LeaderboardEntry, ProjectFilter } from "@/lib/types";
import { LeaderboardProvider } from "@/components/leaderboard/LeaderboardProvider";
import { LeaderboardHero } from "@/components/leaderboard/LeaderboardHero";
import { FiltersBar } from "@/components/leaderboard/FiltersBar";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LeaderboardCTA } from "@/components/leaderboard/LeaderboardCTA";
import { vitrineFontVars } from "@/components/vitrine/fonts";

import "@/components/vitrine/vitrine.css";
import "./leaderboard-vitrine.css";

interface LeaderboardLayoutProps {
  initialEntries: LeaderboardEntry[];
  initialProjectId: string;
  initialSearchTerm: string;
  projects: ProjectFilter[];
  currentUserId?: string;
}

/**
 * La page `/leaderboard`, d'après `Leaderboard Vitrine.dc.html`.
 *
 * La page pose sa propre largeur et sa propre gouttière : `LabShell` lui laisse
 * la pleine largeur sur cette route, et ne garde que la réserve de la navbar.
 */
export function LeaderboardLayout({
  initialEntries,
  initialProjectId,
  initialSearchTerm,
  projects,
  currentUserId,
}: LeaderboardLayoutProps) {
  return (
    <div className={`vitrine v-leaderboard ${vitrineFontVars}`}>
      <LeaderboardProvider
        initialEntries={initialEntries}
        initialProjectId={initialProjectId}
        initialSearchTerm={initialSearchTerm}
        projects={projects}
        currentUserId={currentUserId}
      >
        <div className="v-main">
          <LeaderboardHero />
          <FiltersBar />
          <LeaderboardTable />
          <LeaderboardCTA />
        </div>
      </LeaderboardProvider>
    </div>
  );
}
