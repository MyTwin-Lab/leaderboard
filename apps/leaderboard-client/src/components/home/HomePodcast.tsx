import { PodcastVideos } from "@/components/podcast/PodcastVideos";
import { HomeSectionTitle } from "./HomeSection";

/**
 * Les épisodes de MyTwin Inside, le programme de la chaîne YouTube MyTwin. Le
 * fondateur est nommé avec son rôle, la relation personne → organisation
 * qu'on répète partout (stratégie SEO de mytwin.care).
 */
export function HomePodcast() {
  return (
    <section aria-labelledby="podcast-title" className="flex flex-col gap-4">
      <HomeSectionTitle id="podcast-title">Podcast</HomeSectionTitle>
      <p className="max-w-3xl text-sm leading-relaxed text-white/60 sm:text-base">
        Rubens Valcy, founder of MyTwin, sits down with the clinicians and founders behind the health
        technologies we build with.
      </p>

      {/* Le carrousel mobile dépasse le padding du <main> : les cartes sont
          coupées au bord de l'écran, pas au bord du contenu. */}
      <div className="-mx-4 mt-2 sm:-mx-6 md:mx-0">
        <PodcastVideos />
      </div>
    </section>
  );
}
