import { PODCAST_PLAYLIST_URL } from "@/components/podcast/episodes";
import { HomePodcastRail } from "./HomePodcastRail";
import { HomeMore, HomeSectionHead } from "./HomeSection";

/**
 * Les épisodes de MyTwin Inside, le programme de la chaîne YouTube MyTwin. Le
 * fondateur est nommé avec son rôle, la relation personne → organisation
 * qu'on répète partout (stratégie SEO de mytwin.care).
 */
export function HomePodcast() {
  return (
    <section aria-labelledby="podcast-title" className="v-home-section">
      <HomeSectionHead
        id="podcast-title"
        eyebrow="Podcast · MyTwin Inside"
        tagline="Conversations with the people advancing health."
        href={PODCAST_PLAYLIST_URL}
        linkLabel="All episodes"
      />

      <HomePodcastRail />

      <HomeMore href={PODCAST_PLAYLIST_URL} place="bottom">
        All episodes
      </HomeMore>
    </section>
  );
}
