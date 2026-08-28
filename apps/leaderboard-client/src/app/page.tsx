import { fetchHomeOverview } from "@/lib/server/home";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeLeaderboardPreview } from "@/components/home/HomeLeaderboardPreview";
import { HomeChallengesPreview } from "@/components/home/HomeChallengesPreview";

// HomeStatsCard ("The Lab, right now") is temporarily hidden from the home
// page — component kept in place, just not rendered here. HomeHero takes
// the full width in its place.

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Single aggregated read — see fetchHomeOverview() for why this replaces
  // separate fetchLeaderboard()/fetchTrendingChallenges() calls (each of
  // which re-fetched the same projects/challenges/contributions/users).
  const overview = await fetchHomeOverview();

  return (
    <div className="space-y-10 sm:space-y-14">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <HomeHero />

      {/* ── Leaderboard + Trending challenges ───────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-2">
        <HomeLeaderboardPreview
          podium={overview.podium}
          rest={overview.rest}
          contributorsRanked={overview.contributorsRanked}
        />
        <HomeChallengesPreview challenges={overview.trendingChallenges} />
      </div>

    </div>
  );
}
