import type { LeaderboardEntry, ProjectFilter } from "@/lib/types";
import { LeaderboardProvider } from "@/components/leaderboard/LeaderboardProvider";
import { LeaderboardHero } from "@/components/leaderboard/LeaderboardHero";
import { FiltersBar } from "@/components/leaderboard/FiltersBar";
import { LeaderboardPodium } from "@/components/leaderboard/LeaderboardPodium";
import { LeaderboardListSection } from "@/components/leaderboard/LeaderboardListSection";

interface LeaderboardLayoutProps {
  initialEntries: LeaderboardEntry[];
  initialProjectId: string;
  initialSearchTerm: string;
  projects: ProjectFilter[];
  currentUserId?: string;
}

export function LeaderboardLayout({
  initialEntries,
  initialProjectId,
  initialSearchTerm,
  projects,
  currentUserId,
}: LeaderboardLayoutProps) {
  return (
    <LeaderboardProvider
      initialEntries={initialEntries}
      initialProjectId={initialProjectId}
      initialSearchTerm={initialSearchTerm}
      projects={projects}
      currentUserId={currentUserId}
    >
      <div className="flex flex-col gap-5 sm:gap-6">
        <LeaderboardHero />

        {/* Sticky filters — search box + project dropdown are untouched by
         * the redesign, only the surrounding sticky/fade treatment is new. */}
        <div className="sticky top-[78px] z-20 -mx-1 bg-gradient-to-b from-background from-60% to-background/70 px-1 py-2">
          <FiltersBar />
        </div>

        <LeaderboardPodium />
        <LeaderboardListSection />
      </div>
    </LeaderboardProvider>
  );
}
