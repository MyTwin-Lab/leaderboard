import { fetchHomeOverview } from "@/lib/server/home";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeLatestNews } from "@/components/home/HomeLatestNews";
import { HomePodcast } from "@/components/home/HomePodcast";
import { HomeCommunity } from "@/components/home/HomeCommunity";
import { HomeLeaderboardPreview } from "@/components/home/HomeLeaderboardPreview";
import { HomeChallengesPreview } from "@/components/home/HomeChallengesPreview";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { pageMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/home/home-vitrine.css";

// HomeStatsCard ("The Lab, right now") is temporarily hidden from the home
// page — component kept in place, just not rendered here.

export const dynamic = "force-dynamic";

// L'accueil du Lab, une fois passé la landing `/` : c'est `/` qui porte la
// marque (titre « MyTwin Lab », JSON-LD de l'entité). Cette page vise ce
// qu'elle montre, pour ne pas concurrencer la landing sur « MyTwin Lab ».
export const metadata = pageMetadata({
  title: "Top Contributors, Trending Challenges and News",
  description:
    "Inside MyTwin Lab: the top contributors, the trending health challenges, the latest news and the MyTwin Inside podcast. Every contribution is tracked, evaluated and rewarded in CP.",
  path: "/home",
});

export default async function HomePage() {
  // Single aggregated read — see fetchHomeOverview() for why this replaces
  // separate fetchLeaderboard()/fetchTrendingChallenges() calls (each of
  // which re-fetched the same projects/challenges/contributions/users).
  const overview = await fetchHomeOverview();

  // L'accueil est une page vitrine, comme `/challenges`, `/sandbox` et
  // `/leaderboard` : mêmes polices, mêmes jetons, même conteneur. Elle pose
  // donc elle-même sa largeur et sa gouttière — `LabShell` lui laisse la main
  // sur `/home`, et peint le fond de la maquette sous la navbar et le footer.
  return (
    <div className={`vitrine v-home ${vitrineFontVars}`}>
      <div className="v-main">
        {/* ── Our mission ─────────────────────────────────────────────── */}
        <HomeHero />

        {/* ── News ─────────────────────────────────────────────────────── */}
        <HomeLatestNews />

        {/* ── Podcast (MyTwin Inside) ─────────────────────────────────── */}
        <HomePodcast />

        {/* ── Join our Community ──────────────────────────────────────── */}
        <HomeCommunity />

        {/* ── Top 3 contributors ──────────────────────────────────────── */}
        <HomeLeaderboardPreview podium={overview.podium} />

        {/* ── Challenges (trending) ────────────────────────────────────── */}
        <HomeChallengesPreview challenges={overview.trendingChallenges} />
      </div>
    </div>
  );
}
