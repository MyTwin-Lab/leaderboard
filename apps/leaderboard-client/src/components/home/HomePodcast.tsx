import { PodcastVideos } from "@/components/podcast/PodcastVideos";
import { HomeSectionHead } from "./HomeSection";

/**
 * Les épisodes de MyTwin Inside, le programme de la chaîne YouTube MyTwin. Le
 * fondateur est nommé avec son rôle, la relation personne → organisation
 * qu'on répète partout (stratégie SEO de mytwin.care).
 */
export function HomePodcast() {
  return (
    <section aria-labelledby="podcast-title" className="v-home-section">
      <HomeSectionHead id="podcast-title" title="Podcast" />

      <p className="v-home-lede">
        Rubens Valcy, founder of MyTwin, sits down with the clinicians and founders behind the health
        technologies we build with.
      </p>

      {/* Sur téléphone, le rail des épisodes déborde la gouttière de la page :
          les vignettes défilent jusqu'au bord de l'écran (`home-vitrine.css`). */}
      <div className="v-home-podcast-rail">
        <PodcastVideos />
      </div>
    </section>
  );
}
