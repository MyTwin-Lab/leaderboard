"use client";

import { useRef, useState } from "react";
import Image from "next/image";

import {
  PODCAST_EPISODES,
  podcastEmbedUrl,
  type PodcastEpisode,
  type PodcastEpisodeKey,
} from "@/components/podcast/episodes";

/**
 * Les épisodes MyTwin Inside : le dernier en vedette, les trois autres en rang.
 *
 * Forme de la maquette, comportement de `PodcastVideos` — lancer un épisode
 * met en pause celui qui jouait, et une vidéo déjà lancée garde son iframe
 * plutôt que d'être démontée, pour reprendre au timecode exact.
 *
 * Le bouton couvre la vignette et rien d'autre : le titre reste un `h3` à
 * côté, hors du bouton. Un bouton ne peut pas contenir de titre — et surtout,
 * un lecteur d'écran qui parcourt les titres de la page ne trouverait plus
 * ceux des épisodes s'ils étaient enfouis dans un libellé de commande.
 */
export function HomePodcastRail() {
  const [lead, ...rest] = PODCAST_EPISODES;
  const [active, setActive] = useState<PodcastEpisodeKey | null>(null);
  const [started, setStarted] = useState<ReadonlySet<PodcastEpisodeKey>>(new Set());
  const frames = useRef<Partial<Record<PodcastEpisodeKey, HTMLIFrameElement>>>({});

  const command = (key: PodcastEpisodeKey, func: "playVideo" | "pauseVideo") => {
    frames.current[key]?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*",
    );
  };

  const play = (key: PodcastEpisodeKey) => {
    // Lancer une vidéo met en pause celle qui jouait : sa miniature revient sur
    // une iframe réellement en pause, sans son qui continue derrière.
    if (active !== null && active !== key) command(active, "pauseVideo");
    // La première lecture monte l'iframe (autoplay dans l'URL), les suivantes
    // relancent l'iframe déjà montée.
    if (started.has(key)) command(key, "playVideo");
    else setStarted((current) => new Set(current).add(key));
    setActive(key);
  };

  const shot = (episode: PodcastEpisode, sizes: string) => (
    <>
      {started.has(episode.key) && (
        <iframe
          ref={(element) => {
            frames.current[episode.key] = element ?? undefined;
          }}
          src={podcastEmbedUrl(episode.youtubeId)}
          title={episode.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      )}
      {active !== episode.key && (
        <button
          type="button"
          onClick={() => play(episode.key)}
          aria-label={`Play — ${episode.title}`}
          style={{ position: "absolute", inset: 0, zIndex: 1, width: "100%", height: "100%", cursor: "pointer" }}
        >
          <Image src={episode.thumbnail} alt="" aria-hidden sizes={sizes} placeholder="blur" />
          <span className="v-home-play">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 2.5 13 8l-9 5.5z" />
            </svg>
          </span>
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="v-home-feature">
        <div className="v-home-shot">{shot(lead, "(min-width: 768px) 38rem, 100vw")}</div>
        <div className="v-home-feature-title-only">
          <div style={{ display: "grid", gap: "0.5rem", minWidth: 0 }}>
            <h3>{lead.title}</h3>
            <p>Rubens Valcy, founder of MyTwin, with the teams behind the technology.</p>
          </div>
        </div>
      </div>

      <ul className="v-home-episodes">
        {rest.map((episode) => (
          <li key={episode.key} className="v-home-episode">
            <div className="v-home-episode-shot">
              {shot(episode, "(min-width: 768px) 6.5rem, 42vw")}
            </div>
            <h3 className="v-home-episode-title">{episode.title}</h3>
          </li>
        ))}
      </ul>
    </>
  );
}
