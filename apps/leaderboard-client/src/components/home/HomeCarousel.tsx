"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

/**
 * Un rail de l'accueil et ses points d'avancement.
 *
 * Le rail n'est un carrousel que sur téléphone : au-dessus de 768px,
 * `home-vitrine.css` le repasse en grille et cache les points. Les cartes
 * arrivent en `children` — elles restent rendues par le serveur, seul le suivi
 * du défilement a besoin du client.
 *
 * La carte active se trouve par la distance des centres, comme le carrousel du
 * podcast : c'est la règle qu'applique `scroll-snap-align: center`, donc le
 * point s'allume sur la carte qui vient réellement se caler au milieu. Et c'est
 * le défilement qui fait autorité, jamais l'inverse — avancer tout seul ne fait
 * que défiler, l'état suit par `onScroll`.
 */
export function HomeCarousel({
  railClassName,
  itemNoun,
  autoAdvanceMs,
  children,
}: {
  /** La classe du rail : c'est elle qui porte la grille et le carrousel. */
  railClassName: string;
  /** Sans lui, le rail ne bouge qu'à la main. */
  autoAdvanceMs?: number;
  /** Le nom des éléments, pour les lecteurs d écran : « Show news 2 of 3 ». */
  itemNoun: string;
  children: React.ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Lu par la boucle d'avance sans la relancer à chaque carte.
  const activeRef = useRef(0);
  // L'avance automatique s'arrête à la première intervention et ne repart pas :
  // reprendre la main sous le doigt de quelqu'un qui lit est pire que de ne
  // plus tourner du tout.
  const [handedOver, setHandedOver] = useState(false);
  const count = Children.count(children);

  /** L'écart, en pixels, entre le centre de la carte `index` et celui du rail. */
  const centerOffset = (rail: HTMLDivElement, index: number) => {
    const card = rail.children[index] as HTMLElement | undefined;
    if (!card) return null;
    const railRect = rail.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return cardRect.left + cardRect.width / 2 - (railRect.left + railRect.width / 2);
  };

  const goTo = useCallback((index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const offset = centerOffset(rail, index);
    if (offset === null) return;
    rail.scrollBy({ left: offset, behavior: "smooth" });
  }, []);

  const handleScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    let nearest = 0;
    let shortest = Infinity;
    for (let index = 0; index < count; index += 1) {
      const offset = centerOffset(rail, index);
      if (offset === null) continue;
      if (Math.abs(offset) < shortest) {
        shortest = Math.abs(offset);
        nearest = index;
      }
    }
    activeRef.current = nearest;
    setActive(nearest);
  };

  useEffect(() => {
    if (!autoAdvanceMs || handedOver || count < 2) return;

    const tick = () => {
      const rail = railRef.current;
      if (!rail) return;
      // Les deux conditions sont relues à chaque tour plutôt que de conditionner
      // l'effet : une rotation d'écran ou un changement de préférence système
      // est pris en compte sans avoir à écouter les media queries.
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      goTo((activeRef.current + 1) % count);
    };

    const timer = window.setInterval(tick, autoAdvanceMs);
    return () => window.clearInterval(timer);
  }, [autoAdvanceMs, handedOver, count, goTo]);

  const takeOver = () => setHandedOver(true);

  return (
    <>
      <div
        ref={railRef}
        className={railClassName}
        onScroll={handleScroll}
        onPointerDown={autoAdvanceMs ? takeOver : undefined}
      >
        {children}
      </div>

      <div className="v-home-dots">
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            data-on={index === active ? "true" : "false"}
            aria-label={`Show ${itemNoun} ${index + 1} of ${count}`}
            aria-current={index === active}
            onClick={() => {
              takeOver();
              goTo(index);
            }}
          />
        ))}
      </div>
    </>
  );
}
