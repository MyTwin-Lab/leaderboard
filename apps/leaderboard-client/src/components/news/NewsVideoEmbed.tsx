"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import type { NewsVideo } from "@/content/news/types";
import { NewsFigure } from "./NewsFigure";

const LANGUAGE_NAMES: Record<string, string> = { fr: "French" };

/**
 * Une vidéo servie par le site dans une news. Tant qu'on ne clique pas, la
 * page ne charge que l'affiche, par `next/image` (optimisée, différée) : pas
 * un octet de la vidéo, et rien ne pèse sur le chargement de l'article. Au
 * clic, un `<video>` natif prend sa place et démarre ; le MP4 est en
 * `faststart`, le navigateur le lit par morceaux sans attendre le fichier.
 */
export function NewsVideoEmbed({ video, caption }: { video: NewsVideo; caption?: string }) {
  const [playing, setPlaying] = useState(false);
  const language = video.language === "en" ? null : (LANGUAGE_NAMES[video.language] ?? video.language);
  const fullCaption = [caption, language && `In ${language}.`].filter(Boolean).join(" ");

  return (
    <NewsFigure caption={fullCaption || undefined}>
      <div className="v-nd-video">
        {playing ? (
          <video
            src={video.src}
            poster={video.poster}
            title={video.title}
            controls
            autoPlay
            playsInline
            preload="auto"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video — ${video.title}`}
            className="v-nd-video-btn"
          >
            <Image
              src={video.poster}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 44rem"
              className="object-cover"
              draggable={false}
            />
            <span className="v-nd-video-scrim" />
            <span className="v-nd-video-play">
              <Play className="h-6 w-6 translate-x-0.5 fill-current" />
            </span>
          </button>
        )}
      </div>
    </NewsFigure>
  );
}
