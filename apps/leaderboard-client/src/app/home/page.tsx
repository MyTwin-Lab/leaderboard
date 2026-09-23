import { fetchHomeOverview } from "@/lib/server/home";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeVision } from "@/components/home/HomeVision";
import { HomeLatestNews } from "@/components/home/HomeLatestNews";
import { HomePodcast } from "@/components/home/HomePodcast";
import { HomeCommunity } from "@/components/home/HomeCommunity";
import { HomeLeaderboardPreview } from "@/components/home/HomeLeaderboardPreview";
import { HomeChallengesPreview } from "@/components/home/HomeChallengesPreview";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { pageMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/home/home-vitrine.css";

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

  // L'ordre est celui de `Home Redesign.dc.html` : la mission, la vision qui
  // l'explique, puis ce que le Lab produit — news, podcast — avant d'appeler
  // à rejoindre, et de montrer qui contribue et sur quoi.
  //
  // La navbar et le pied de page de la maquette ne sont pas repris : `LabShell`
  // les pose déjà pour toute l'app, et cette page n'a pas à en porter une
  // seconde paire.
  return (
    <div className={`vitrine v-home ${vitrineFontVars}`}>
      <div className="v-home-main">
        <HomeHero />
        <HomeVision />
        <HomeLatestNews />
        <HomePodcast />
        <HomeCommunity />
        <HomeLeaderboardPreview podium={overview.podium} />
        <HomeChallengesPreview challenges={overview.trendingChallenges} />
      </div>
    </div>
  );
}
