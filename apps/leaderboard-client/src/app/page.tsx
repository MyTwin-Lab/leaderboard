import { fetchHomeOverview } from "@/lib/server/home";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeVision } from "@/components/home/HomeVision";
import { HomeLatestNews } from "@/components/home/HomeLatestNews";
import { HomePodcast } from "@/components/home/HomePodcast";
import { HomeCreateTwin } from "@/components/home/HomeCreateTwin";
import { HomeCommunity } from "@/components/home/HomeCommunity";
import { HomeLeaderboardPreview } from "@/components/home/HomeLeaderboardPreview";
import { HomeChallengesPreview } from "@/components/home/HomeChallengesPreview";
import { HomeGate } from "@/components/home/HomeGate";
import { JsonLd } from "@/components/seo/JsonLd";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import {
  DEFAULT_DESCRIPTION,
  jsonLdGraph,
  labOrganizationJsonLd,
  pageMetadata,
  websiteJsonLd,
} from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/home/home-vitrine.css";
import "@/components/home/home-gate.css";

export const dynamic = "force-dynamic";

// La racine porte la marque : c'est elle qui doit sortir sur la requête
// « MyTwin Lab », et elle porte le JSON-LD de l'entité. « Digital twin » est
// laissé à mytwin.care, qui tient ce territoire : jamais dans un titre.
//
// L'accueil du Lab vivait sur `/home` et la landing sur `/`. Les deux n'en
// font plus qu'une : la landing disparaît, l'accueil prend la racine. Le titre
// et le JSON-LD viennent donc de l'ancienne landing, le contenu de l'ancien
// `/home`. `/home` redirige en 308 (voir `next.config.ts`) — l'URL était
// indexée, elle ne doit pas répondre 404.
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

  // L'ordre est celui de `Home Redesign.dc.html` : la mission, la vision qui
  // l'explique, puis ce que le Lab produit — news, podcast — avant d'appeler à
  // rejoindre, et de montrer qui contribue et sur quoi.
  //
  // « Create your twin » fait exception et ferme la page. La maquette le posait
  // au milieu ; c'est le seul encart qui sort du Lab, et il se lit mieux une
  // fois le Lab montré — on part vers mytwin.care après avoir vu, pas avant.
  //
  // La navbar et le pied de page de la maquette ne sont pas repris : `LabShell`
  // les pose déjà pour toute l'app, et cette page n'a pas à en porter une
  // seconde paire.
  return (
    <>
      <JsonLd data={jsonLdGraph(labOrganizationJsonLd(), websiteJsonLd())} />
      <HomeGate />
      <div className={`vitrine v-home ${vitrineFontVars}`}>
        <div className="v-home-main">
          <HomeHero />
          <HomeVision />
          <HomeLatestNews />
          <HomePodcast />
          <HomeCommunity />
          <HomeLeaderboardPreview podium={overview.podium} />
          <HomeChallengesPreview challenges={overview.trendingChallenges} />
          <HomeCreateTwin />
        </div>
      </div>
    </>
  );
}
