"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { getPodcastEpisode, podcastEmbedUrl, type PodcastEpisodeKey } from "./episodes";

/**
 * Un épisode MyTwin Inside posé dans une news : la miniature d'abord, la vidéo
 * YouTube seulement au clic (rien n'est envoyé à YouTube avant).
 *
 * Couleurs écrites en clair et non en `border-white/10` : la page d'une news
 * est une vitrine, sur fond clair, où `globals.css` ne réécrit rien.
 */
export function PodcastEpisodeEmbed({ episode: key }: { episode: PodcastEpisodeKey }) {
  const episode = getPodcastEpisode(key);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="group relative aspect-video overflow-hidden rounded-xl bg-[#11161a]">
      {playing ? (
        <iframe
          src={podcastEmbedUrl(episode.youtubeId)}
          title={episode.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video — MyTwin Inside: ${episode.title}`}
          className="absolute inset-0 h-full w-full cursor-pointer"
        >
          <Image
            src={episode.thumbnail}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 48rem"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            draggable={false}
          />
          <span className="absolute inset-0 bg-gradient-to-t from-[#11161a]/55 via-[#11161a]/10 to-transparent" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#3FA1AA] text-[#ffffff] shadow-lg transition-transform duration-300 group-hover:scale-110">
            <Play className="h-6 w-6 translate-x-0.5 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
