"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ScrollSpy = {
  active: string | null;
  /** Fait défiler jusqu'à une section et garde la surbrillance jusqu'à l'arrivée. */
  select: (id: string) => void;
};

// La section qui couvre ce point (fraction de la hauteur de l'écran, depuis le
// haut) est l'active. Une seule ligne : la bascule tombe au même endroit en
// montant et en descendant, le sommaire n'a jamais une section de retard.
const ACTIVE_LINE_RATIO = 0.5;

// Aligné sur le `scroll-mt-24` des titres : un clic les pose au même endroit
// qu'une ancre, sous la navbar.
const HEADER_OFFSET = 96;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * La section en vue, pour le sommaire d'une news. Porté depuis
 * `use-scroll-spy.ts` de mytwin.care.
 *
 * `select` anime son propre défilement plutôt que `scroll-behavior`, brutal sur
 * les longues distances, et garde la cible cliquée allumée tout le trajet.
 */
export function useScrollSpy(ids: string[]): ScrollSpy {
  const [active, setActive] = useState<string | null>(null);
  // Pendant un défilement lancé par un clic, la cible garde la surbrillance :
  // les sections traversées ne s'allument pas au passage.
  const lockedRef = useRef(false);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!ids.length) return;

    let raf = 0;
    const compute = () => {
      raf = 0;
      if (lockedRef.current) return;
      const line = window.innerHeight * ACTIVE_LINE_RATIO;
      let current: string | null = null;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ids]);

  const select = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    setActive(id);
    lockedRef.current = true;
    releaseRef.current?.();

    const startY = window.scrollY;
    const targetY = Math.max(0, Math.round(startY + element.getBoundingClientRect().top - HEADER_OFFSET));
    const distance = targetY - startY;

    let raf = 0;
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      lockedRef.current = false;
      releaseRef.current = null;
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || distance === 0) {
      window.scrollTo({ top: targetY, behavior: "instant" });
      stop();
      return;
    }

    // Durée proportionnelle à la distance, bornée : ni lente sur un saut court,
    // ni précipitée sur un long.
    const duration = Math.min(900, Math.max(500, Math.abs(distance) * 0.5));
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      window.scrollTo({ top: Math.round(startY + distance * easeInOutCubic(t)), behavior: "instant" });
      if (t < 1) raf = requestAnimationFrame(step);
      else stop();
    };

    // Un défilement manuel en cours d'animation rend la main tout de suite.
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    raf = requestAnimationFrame(step);
    releaseRef.current = stop;
  }, []);

  useEffect(() => () => releaseRef.current?.(), []);

  return { active, select };
}
