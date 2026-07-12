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

      {/* ── Hero — truly full-bleed, behind navbar ─────────────────────
          width: 100vw + margin-left: calc(50% - 50vw) = breaks out of
          any centered container to span edge-to-edge.
          -mt-20 md:-mt-24 cancels the navbar padding so the hero
          background starts at the very top of the viewport.
          Inner div restores the correct top padding for content.      */}
      <section
        className="-mt-20 rounded-b-3xl md:-mt-24"
        style={{
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          background: "color-mix(in srgb, var(--foreground) 92%, var(--background))",
        }}
      >
        {/* Decorative brandCP orb — top right */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full sm:right-0 sm:top-0"
          style={{
            background: "radial-gradient(circle, var(--theme-primary), transparent 70%)",
            opacity: 0.15,
          }}
        />

        {/* Subtle grid lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--background) 1px, transparent 1px), linear-gradient(90deg, var(--background) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Inner container — recenters content, restores navbar clearance */}
        <div
          className="relative mx-auto max-w-6xl overflow-hidden px-4 pb-12 pt-24 sm:px-6 md:pt-32"
          style={{ color: "var(--background)" }}
        >
          {/* Eyebrow */}
          <div className="animate-fade-up mb-6 flex items-center gap-3">
            <span className="h-[2px] w-8 rounded-full bg-brandCP" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-brandCP">
              #WeAreNotWaiting
            </span>
          </div>

          {/* H1 */}
          <h1
            className="animate-fade-up max-w-xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl"
            style={{ animationDelay: "60ms" }}
          >
            A global movement<br />
            to reinvent health.<br />
            <span className="text-brandCP">Together.</span>
          </h1>

          {/* Body */}
          <p
            className="animate-fade-up mt-5 max-w-lg text-sm leading-relaxed sm:text-base"
            style={{ animationDelay: "120ms", opacity: 0.65 }}
          >
            It&apos;s a movement — a collective uprising of students, engineers, clinicians,
            researchers, designers, startups, and citizens who refuse to wait for health
            innovation to happen <em>to</em> them.{" "}
            <strong style={{ opacity: 1 }}>We build it ourselves. We build it together.</strong>
          </p>

          {/* Quote */}
          <blockquote
            className="animate-fade-up mt-4 flex items-start gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <span className="mt-[9px] h-[2px] w-5 shrink-0 rounded-full bg-brandCP opacity-60" />
            <p className="text-sm italic" style={{ opacity: 0.45 }}>
              If you contribute, you exist. If you build, you shine.
            </p>
          </blockquote>
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
