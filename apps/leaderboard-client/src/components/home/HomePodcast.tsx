import { PODCAST_PLAYLIST_URL } from "@/components/podcast/episodes";
import { PodcastVideos } from "@/components/podcast/PodcastVideos";
import { HomeSectionHeader } from "./HomeSectionHeader";

/**
 * MyTwin Inside est le programme de la chaîne YouTube MyTwin, pas « le podcast
 * MyTwin » : c'est le nom qui titre, « Podcast » n'est que le libellé. Le
 * fondateur est nommé avec son rôle, la relation personne → organisation
 * qu'on répète partout (stratégie SEO de mytwin.care).
 */
export function HomePodcast() {
  return (
    <section aria-labelledby="podcast-title" className="flex flex-col gap-4">
      <HomeSectionHeader
        id="podcast-title"
        label="Podcast"
        title="MyTwin Inside"
        link={{ href: PODCAST_PLAYLIST_URL, label: "All episodes" }}
      />
      <p className="max-w-3xl text-sm leading-relaxed text-white/60 sm:text-base">
        Rubens Valcy, founder of MyTwin, sits down with the clinicians and founders behind the health
        technologies we build with.
      </p>

      {/* Le carrousel mobile dépasse le padding du <main> : les cartes sont
          coupées au bord de l'écran, pas au bord du contenu. */}
      <div className="-mx-4 mt-2 sm:-mx-6 md:mx-0">
        <PodcastVideos />
      </div>

      <p className="text-xs text-white/40">Videos load from YouTube only when you press play.</p>
    </section>
  );
}
