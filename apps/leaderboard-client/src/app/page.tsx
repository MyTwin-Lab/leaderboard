import Link from "next/link";
import { fetchLeaderboard } from "@/lib/server/leaderboard";
import { fetchTrendingChallenges } from "@/lib/server/publicPages";
import { HomeLeaderboardPreview } from "@/components/home/HomeLeaderboardPreview";
import { HomeChallengesPreview } from "@/components/home/HomeChallengesPreview";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [leaderboardData, trendingChallenges] = await Promise.all([
    fetchLeaderboard("all"),
    fetchTrendingChallenges(3),
  ]);

  const top5 = leaderboardData.entries.slice(0, 5);

  return (
    <div className="space-y-8 sm:space-y-10">

      {/* ── About section ─────────────────────────────────────────── */}
      <section className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md shadow-black/20 sm:p-8">
        <h2 className="mb-4 text-xl font-semibold text-white sm:text-2xl">
          A global movement to reinvent health.{" "}
          <span className="text-brandCP">Together.</span>
        </h2>

        <div className="space-y-3 text-sm text-white/70 sm:text-base">
          <p>
            We are a collective uprising of students, engineers, clinicians, researchers, and citizens
            who refuse to wait for health innovation to happen to them.{" "}
            <strong className="text-white">We build it together.</strong>
          </p>
          <blockquote className="rounded-sm border-l-4 border-brandCP py-1 pl-4 text-sm italic text-white/60 sm:text-base">
            If you contribute, you exist. If you build, you shine.
          </blockquote>
        </div>

        <div className="mt-6">
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2.5"
          >
            Learn more
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Leaderboard + Challenges grid ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">

        {/* Top 5 Leaderboard */}
        <div className="animate-fade-up flex flex-col gap-4" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white sm:text-xl">Top Contributors</h2>
            <span className="flex items-center gap-1.5 text-xs text-white/35">
              <span className="inline-block h-1.5 w-1.5 animate-ping-slow rounded-full bg-brandCP/70" />
              Live
            </span>
          </div>

          <HomeLeaderboardPreview entries={top5} />

          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2.5"
          >
            View full leaderboard
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Trending Challenges */}
        <div className="animate-fade-up flex flex-col gap-4" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white sm:text-xl">Trending Challenges</h2>
            <span className="text-xs text-white/35">Last 7 days</span>
          </div>

          <HomeChallengesPreview challenges={trendingChallenges} />

          <Link
            href="/challenges"
            className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2.5"
          >
            View all challenges
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

      </div>

    </div>
  );
}
