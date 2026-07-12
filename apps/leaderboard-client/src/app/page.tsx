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
    <div className="space-y-10 sm:space-y-14">

      {/* ── Hero section ──────────────────────────────────────────────── */}
      <section className="relative -mx-4 overflow-hidden rounded-b-3xl sm:-mx-6">
        {/* Dark background */}
        <div className="absolute inset-0 bg-backgroundDark" />

        {/* Radial brandCP glow at top-center */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% -10%, var(--theme-primary), transparent)",
            opacity: 0.07,
          }}
        />

        {/* Subtle grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(var(--theme-primary) 1px, transparent 1px), linear-gradient(90deg, var(--theme-primary) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Content */}
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center sm:px-12 sm:py-28">

          {/* Eyebrow */}
          <div className="mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-brandCP/20 bg-brandCP/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 animate-ping-slow rounded-full bg-brandCP" />
            <span className="text-xs font-semibold uppercase tracking-widest text-brandCP">
              #WeAreNotWaiting
            </span>
          </div>

          {/* H1 */}
          <h1
            className="animate-fade-up text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Building the world's most advanced{" "}
            <span className="text-brandCP">health digital twin.</span>
          </h1>

          {/* Subtitle */}
          <p
            className="animate-fade-up mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg"
            style={{ animationDelay: "160ms" }}
          >
            Students, clinicians, engineers and researchers — building what
            institutions can't. Open. Global.{" "}
            <strong className="text-white/90">Now.</strong>
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/challenges"
              className="inline-flex items-center gap-2 rounded-xl bg-brandCP px-6 py-3 text-sm font-semibold text-backgroundDark shadow-lg shadow-brandCP/20 transition-all duration-200 hover:scale-[1.03] hover:shadow-brandCP/30"
            >
              Explore challenges
              <ArrowIcon />
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.10]"
            >
              View leaderboard
              <ArrowIcon />
            </Link>
          </div>

          {/* Stats strip */}
          <div
            className="animate-fade-up mt-14 flex items-center justify-center gap-8 sm:gap-12"
            style={{ animationDelay: "320ms" }}
          >
            {[
              { label: "Contributors", value: leaderboardData.entries.length.toString() + "+" },
              { label: "Challenges", value: trendingChallenges.length > 0 ? "Active now" : "Coming soon" },
              { label: "Mission", value: "#WeAreNotWaiting" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-base font-bold text-white sm:text-lg">{value}</div>
                <div className="mt-0.5 text-xs text-white/35">{label}</div>
              </div>
            ))}
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
