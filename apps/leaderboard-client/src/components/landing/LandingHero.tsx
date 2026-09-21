"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";

const SLIDE_MS = 7000;

// Images décoratives : le message est dans le titre, d'où les `alt` vides.
const SLIDES = [
  { src: "/landing/hero/digital-twin-hologram.webp", position: "50% 50%" },
  { src: "/landing/hero/research-microscope.webp", position: "52% 40%" },
  { src: "/landing/hero/movement-pose-estimation.webp", position: "55% 50%" },
  { src: "/landing/hero/3d-printed-heart.webp", position: "45% 45%" },
] as const;

export function LandingHero() {
  const heroRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  // Le scroll pilote `--p` (0 → 1) : le CSS en tire la découpe arrondie du
  // cadre et le léger parallax de l'image. Une écriture par frame, pas de state.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.6)));
      hero.style.setProperty("--p", progress.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((current) => (current + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section ref={heroRef} className="l-hero" style={{ "--l-slide-ms": `${SLIDE_MS}ms` } as CSSProperties}>
      <div className="l-hero__frame">
        <div className="l-hero__media" aria-hidden>
          {SLIDES.map((slide, index) => (
            <div key={slide.src} className="l-hero__slide" data-active={index === active}>
              <Image
                src={slide.src}
                alt=""
                fill
                sizes="100vw"
                priority={index === 0}
                loading={index === 0 ? undefined : "eager"}
                style={{ objectPosition: slide.position }}
              />
            </div>
          ))}
        </div>
        <div className="l-hero__scrim" aria-hidden />

        <div className="l-hero__content">
          <h1 className="l-heading l-hero__title">
            We are building the world’s most advanced human digital twin
          </h1>
          <Image
            src="/landing/logo/mytwin-lab-logo-dark.png"
            alt="MyTwin Lab"
            width={644}
            height={246}
            priority
            className="l-hero__logo"
          />
        </div>

        <div className="l-hero__ticks" aria-hidden>
          {SLIDES.map((slide, index) => (
            <div key={slide.src} className="l-hero__tick" data-active={index === active}>
              <span />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
