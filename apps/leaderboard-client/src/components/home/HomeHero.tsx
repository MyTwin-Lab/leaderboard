"use client";

import { useRef, useState } from "react";

/**
 * La mission, et la vidéo qui la donne à voir — les deux côte à côte dès que
 * l'écran leur en laisse la place, empilés sinon.
 *
 * La vidéo est muette (le fichier n'a pas de piste audio) : elle démarre donc
 * seule, comme une illustration animée et non comme un lecteur qu'on vient
 * mettre en marche. Mais elle ne boucle pas — une fois finie elle reste sur sa
 * dernière image, et c'est un clic qui la rejoue. `playsInline` garde iOS dans
 * la page au lieu du plein écran.
 */
export function HomeHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);

  function replay() {
    const video = videoRef.current;
    if (!video || !ended) return;
    video.currentTime = 0;
    void video.play();
  }

  return (
    <section className="v-home-hero">
      <div className="v-home-hero-text">
        <h1 className="v-title">Our mission</h1>
        <p className="v-lede">
          Students, engineers, clinicians, researchers and citizens contributing to a shared
          mission: creating the most advanced digital twin of the human body and making the
          best health innovations accessible to everyone. Every contribution is tracked,
          evaluated and rewarded in CP.
        </p>
      </div>

      <div className="v-home-video">
        <video
          ref={videoRef}
          src="/home/mytwinlab-video.mp4"
          width={1920}
          height={1080}
          autoPlay
          muted
          playsInline
          preload="metadata"
          aria-label="MyTwin Lab: the digital twin of the human body, and the community building it."
          data-ended={ended ? "true" : "false"}
          onEnded={() => setEnded(true)}
          onPlay={() => setEnded(false)}
          onClick={replay}
        />
      </div>
    </section>
  );
}
