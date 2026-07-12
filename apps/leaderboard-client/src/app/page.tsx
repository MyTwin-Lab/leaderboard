import Link from "next/link";
import { fetchLeaderboard } from "@/lib/server/leaderboard";
import { fetchTrendingChallenges } from "@/lib/server/publicPages";
import { HomeLeaderboardPreview } from "@/components/home/HomeLeaderboardPreview";
import { HomeChallengesPreview } from "@/components/home/HomeChallengesPreview";

export const dynamic = "force-dynamic";

const ArrowIcon = () => (
  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
  </svg>
);

export default async function HomePage() {
  const [leaderboardData, trendingChallenges] = await Promise.all([
    fetchLeaderboard("all"),
    fetchTrendingChallenges(3),
  ]);

  const top5 = leaderboardData.entries.slice(0, 5);

  return (
    <div className="space-y-8 sm:space-y-10">

      {/* ── Hero section ───────────────────────────────────────────────
          Full-bleed within container (-mx-4 sm:-mx-6).
          Background: always 12% darker than the theme background,
          works for both light and dark themes.                        */}
      <section
        className="relative -mx-4 overflow-hidden rounded-b-3xl sm:-mx-6"
        style={{ background: "color-mix(in srgb, black 12%, var(--background))" }}
      >
        {/* Radial brandCP glow at top-center */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 50% -5%, var(--theme-primary), transparent)",
            opacity: 0.08,
          }}
        />

        {/* Content */}
        <div className="relative px-6 py-10 sm:px-12 sm:py-14">

          {/* Eyebrow */}
          <div className="mb-5 inline-flex animate-fade-up items-center gap-2 rounded-full border border-brandCP/20 bg-brandCP/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-ping-slow rounded-full bg-brandCP" />
            <span className="text-xs font-semibold uppercase tracking-widest text-brandCP">
              #WeAreNotWaiting
            </span>
          </div>

          {/* Headline — original text from /about */}
          <h1
            className="animate-fade-up max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl"
            style={{ animationDelay: "60ms" }}
          >
            A global movement to reinvent health.{" "}
            <span className="text-brandCP">Together.</span>
          </h1>

          {/* Subtitle — original intro from /about */}
          <p
            className="animate-fade-up mt-4 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base"
            style={{ animationDelay: "120ms" }}
          >
            It&apos;s a movement — a collective uprising of students, engineers, clinicians,
            researchers, designers, startups, and citizens who refuse to wait for health
            innovation to happen <em>to</em> them.{" "}
            <strong className="text-white/90">We build it together.</strong>
          </p>

          {/* Quote */}
          <blockquote
            className="animate-fade-up mt-4 border-l-4 border-brandCP py-0.5 pl-4 text-sm italic text-white/50"
            style={{ animationDelay: "160ms" }}
          >
            If you contribute, you exist. If you build, you shine.
          </blockquote>

          {/* CTAs */}
          <div
            className="animate-fade-up mt-7 flex flex-wrap gap-3"
            style={{ animationDelay: "200ms" }}
          >
            <Link
              href="/challenges"
              className="inline-flex items-center gap-2 rounded-xl bg-brandCP px-5 py-2.5 text-sm font-semibold text-backgroundDark shadow-lg shadow-brandCP/20 transition-all duration-200 hover:scale-[1.03] hover:shadow-brandCP/30"
            >
              Explore challenges
              <ArrowIcon />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.10]"
            >
              Learn more
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Leaderboard + Challenges grid ─────────────────────────────── */}
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
            <ArrowIcon />
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
            <ArrowIcon />
          </Link>
        </div>

      </div>

    </div>
  );
}
