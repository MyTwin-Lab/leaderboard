"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import type { NewsVideo } from "@/content/news/types";

/** Le texte brut d'un sous-titre : balises WebVTT et entités résolues. */
function cueText(cue: TextTrackCue): string {
  const vtt = cue as VTTCue;
  return (vtt.getCueAsHTML?.().textContent ?? vtt.text ?? "").trim();
}

/**
 * Le lecteur vidéo des news, qui remplit son cadre. Tant qu'on ne clique pas,
 * la page ne charge que l'image, par `next/image` : pas un octet de la vidéo.
 * Au clic, un `<video>` natif prend sa place et démarre ; le MP4 est en
 * `faststart`, le navigateur le lit par morceaux.
 *
 * Les sous-titres sont une piste WebVTT que le lecteur dessine lui-même, sur
 * la vidéo, à la typographie du Lab : la piste reste en mode `hidden`, et
 * l'on affiche ses cues actives. Le bouton CC des contrôles natifs garde la
 * main : le passer à « off » retire la surimpression. En plein écran natif
 * (iPhone, ou le bouton plein écran des contrôles) la surimpression n'est plus
 * dans la page : la piste repasse en `showing` et le navigateur la dessine,
 * stylée par `::cue`.
 */
export function NewsVideoPlayer({
  video,
  poster,
  posterPosition,
  sizes,
  priority = false,
}: {
  video: NewsVideo;
  /** L'image avant le clic ; l'affiche de la vidéo par défaut. */
  poster?: string;
  posterPosition?: string;
  sizes: string;
  /** En tête d'article, l'image est au-dessus de la ligne de flottaison. */
  priority?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [cue, setCue] = useState<string | null>(null);
  const [captionsOn, setCaptionsOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const image = poster ?? video.poster;

  useEffect(() => {
    const el = videoRef.current;
    if (!playing || !el) return;
    const track = Array.from(el.textTracks).find((t) => t.kind === "subtitles" || t.kind === "captions");
    if (!track) return;

    // Le cadre peut s'ouvrir au lancement (la bande de tête passe en 16:9) :
    // le lecteur entier revient dans l'écran.
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });

    let on = true;
    let nativeFullscreen = false;

    const apply = () => {
      track.mode = !on ? "disabled" : nativeFullscreen ? "showing" : "hidden";
    };

    const onCueChange = () => {
      const active = track.activeCues;
      const text = active ? Array.from(active).map(cueText).filter(Boolean).join("\n") : "";
      setCue(text || null);
    };

    // Le bouton CC natif passe la piste en `showing` ou `disabled` : on en
    // prend acte, et l'on garde la main sur le dessin hors plein écran.
    const onTracksChange = () => {
      if (track.mode === "disabled" && on) {
        on = false;
        setCaptionsOn(false);
      } else if (track.mode === "showing" && !nativeFullscreen) {
        on = true;
        setCaptionsOn(true);
        track.mode = "hidden";
      }
    };

    const setFullscreen = (value: boolean) => {
      nativeFullscreen = value;
      apply();
    };
    const onDocumentFullscreen = () => setFullscreen(document.fullscreenElement === el);
    const onWebkitBegin = () => setFullscreen(true);
    const onWebkitEnd = () => setFullscreen(false);

    apply();
    track.addEventListener("cuechange", onCueChange);
    el.textTracks.addEventListener("change", onTracksChange);
    document.addEventListener("fullscreenchange", onDocumentFullscreen);
    el.addEventListener("webkitbeginfullscreen", onWebkitBegin);
    el.addEventListener("webkitendfullscreen", onWebkitEnd);
    return () => {
      track.removeEventListener("cuechange", onCueChange);
      el.textTracks.removeEventListener("change", onTracksChange);
      document.removeEventListener("fullscreenchange", onDocumentFullscreen);
      el.removeEventListener("webkitbeginfullscreen", onWebkitBegin);
      el.removeEventListener("webkitendfullscreen", onWebkitEnd);
    };
  }, [playing]);

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`Play video — ${video.title}`}
        className="v-nd-player v-nd-video-btn"
      >
        <Image
          src={image}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          style={{ objectPosition: posterPosition }}
          draggable={false}
        />
        <span className="v-nd-video-scrim" />
        <span className="v-nd-video-play">
          <Play className="h-6 w-6 translate-x-0.5 fill-current" />
        </span>
      </button>
    );
  }

  return (
    <div className="v-nd-player">
      <video
        ref={videoRef}
        src={video.src}
        poster={image}
        title={video.title}
        controls
        autoPlay
        playsInline
        preload="auto"
      >
        {video.captions && (
          <track
            kind="subtitles"
            src={video.captions.src}
            srcLang={video.captions.lang}
            label={video.captions.label}
            default
          />
        )}
      </video>
      {captionsOn && cue && (
        <div className="v-nd-subs" aria-hidden>
          <span className="v-nd-sub">{cue}</span>
        </div>
      )}
    </div>
  );
}
