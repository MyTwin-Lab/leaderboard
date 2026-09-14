import { fetchHomeOverview } from "@/lib/server/home";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeLeaderboardPreview } from "@/components/home/HomeLeaderboardPreview";
import { HomeChallengesPreview } from "@/components/home/HomeChallengesPreview";
import { JsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_DESCRIPTION, jsonLdGraph, labOrganizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";

// HomeStatsCard ("The Lab, right now") is temporarily hidden from the home
// page — component kept in place, just not rendered here. HomeHero takes
// the full width in its place.

export const dynamic = "force-dynamic";

// Le titre de l'accueil commence par la marque : c'est la page qui doit
// sortir sur la requête « MyTwin Lab ». « Digital twin » est laissé à
// mytwin.care, qui porte ce territoire — les deux sites ne se disputent pas
// les mêmes requêtes.
export const metadata = pageMetadata({
  absoluteTitle: "MyTwin Lab | Open Health Innovation Community",
  description: DEFAULT_DESCRIPTION,
  path: "/",
});

export default async function HomePage() {
  // Single aggregated read — see fetchHomeOverview() for why this replaces
  // separate fetchLeaderboard()/fetchTrendingChallenges() calls (each of
  // which re-fetched the same projects/challenges/contributions/users).
  const overview = await fetchHomeOverview();

  return (
    <div className="space-y-10 sm:space-y-14">
      <JsonLd data={jsonLdGraph(labOrganizationJsonLd(), websiteJsonLd())} />

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
