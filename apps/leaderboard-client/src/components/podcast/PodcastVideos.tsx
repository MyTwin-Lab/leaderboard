"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { PODCAST_EPISODES, podcastEmbedUrl, type PodcastEpisodeKey } from "./episodes";

/**
 * La grille des épisodes MyTwin Inside : deux puis quatre colonnes en desktop,
 * un carrousel à défilement horizontal en mobile. Portée depuis
 * `podcast-videos.tsx` de mytwin.care, même comportement.
 */

// Distance signée entre le centre de la carte `index` et celui de la zone de
// défilement, plus la demi-largeur de la carte comme seuil « elle est centrée ».
function cardCenterOffset(list: HTMLElement, index: number) {
  const card = list.children[index] as HTMLElement;
  const listRect = list.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const delta = cardRect.left + cardRect.width / 2 - (listRect.left + listRect.width / 2);
  return { delta, half: cardRect.width / 2 };
}

export function PodcastVideos() {
  // `active` = la carte au premier plan, qui joue. `started` = les cartes dont
  // l'iframe est montée : une vidéo lancée garde son iframe, mise en pause et
  // relancée par l'API IFrame de YouTube plutôt que démontée, pour qu'un aller-
  // retour au swipe reprenne au timecode exact au lieu de repartir de zéro.
  const [active, setActive] = useState<PodcastEpisodeKey | null>(null);
  const [started, setStarted] = useState<ReadonlySet<PodcastEpisodeKey>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);
  const iframeRefs = useRef<Partial<Record<PodcastEpisodeKey, HTMLIFrameElement>>>({});

  const command = (key: PodcastEpisodeKey, func: "playVideo" | "pauseVideo") => {
    iframeRefs.current[key]?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  };

  const activate = (key: PodcastEpisodeKey) => {
    // Lancer une vidéo met en pause celle qui jouait : sa miniature revient sur
    // une iframe réellement en pause, sans son qui continue derrière.
    if (active !== null && active !== key) command(active, "pauseVideo");
    // La première lecture monte l'iframe (autoplay dans l'URL), les suivantes
    // relancent l'iframe déjà montée.
    if (started.has(key)) command(key, "playVideo");
    else setStarted((prev) => new Set(prev).add(key));
    setActive(key);
  };

  // En carrousel mobile, un tap ne lance que la carte centrée ; taper une
  // voisine qui dépasse la fait défiler au centre au lieu de lancer une vidéo
  // hors écran. En desktop, la grille ne déborde pas : tout tap lance.
  const handleCardClick = (key: PodcastEpisodeKey, index: number) => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) {
      activate(key);
      return;
    }
    const { delta, half } = cardCenterOffset(list, index);
    if (Math.abs(delta) < half) activate(key);
    else list.scrollBy({ left: delta, behavior: "smooth" });
  };

  // S'éloigner au swipe de la vidéo qui joue la met en pause et ramène sa
  // miniature ; la retoucher reprend où elle s'était arrêtée.
  const handleScroll = () => {
    const list = listRef.current;
    if (active === null || !list) return;
    const index = PODCAST_EPISODES.findIndex((episode) => episode.key === active);
    const { delta, half } = cardCenterOffset(list, index);
    if (Math.abs(delta) > half) {
      command(active, "pauseVideo");
      setActive(null);
    }
  };

  return (
    <ul
      ref={listRef}
      onScroll={handleScroll}
      className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:px-6 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden"
    >
      {PODCAST_EPISODES.map(({ key, youtubeId, title, thumbnail }, index) => (
        <li key={key} className="w-[85%] shrink-0 snap-center md:w-auto">
          <div className="group relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_14px_40px_-26px_rgba(0,0,0,0.6)]">
            {started.has(key) && (
              <iframe
                ref={(element) => {
                  iframeRefs.current[key] = element ?? undefined;
                }}
                src={podcastEmbedUrl(youtubeId)}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            )}
            {active !== key && (
              <button
                type="button"
                onClick={() => handleCardClick(key, index)}
                aria-label={`Play video — ${title}`}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer"
              >
                <Image
                  src={thumbnail}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 85vw, (max-width: 1279px) 45vw, 280px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  draggable={false}
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#41ADA3] shadow-lg transition-transform duration-300 group-hover:scale-110">
                  <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                </span>
              </button>
            )}
          </div>
          <h3 className="mt-3 text-pretty text-sm font-medium leading-snug text-white sm:text-base">{title}</h3>
        </li>
      ))}
    </ul>
  );
}
