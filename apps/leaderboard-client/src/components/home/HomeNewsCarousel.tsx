"use client";

import { Children, useRef, useState } from "react";

/**
 * Le rail des news et ses points d'avancement.
 *
 * Le rail n'est un carrousel que sur téléphone — au-dessus de 768px,
 * `home-vitrine.css` le repasse en grille et cache les points. Les cartes
 * arrivent en `children` : elles sont rendues par le serveur (`HomeLatestNews`),
 * seul le suivi du défilement a besoin du client.
 *
 * La carte active se trouve par la distance des centres, comme le carrousel du
 * podcast : c'est la même règle que `scroll-snap-align: center` applique, donc
 * le point s'allume sur la carte qui vient réellement se caler au milieu.
 */
export function HomeNewsCarousel({ children }: { children: React.ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);

  /** L'écart, en pixels, entre le centre de la carte `index` et celui du rail. */
  const centerOffset = (rail: HTMLDivElement, index: number) => {
    const card = rail.children[index] as HTMLElement | undefined;
    if (!card) return null;
    const railRect = rail.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return cardRect.left + cardRect.width / 2 - (railRect.left + railRect.width / 2);
  };

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
    setActive(nearest);
  };

  const goTo = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const offset = centerOffset(rail, index);
    if (offset === null) return;
    rail.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <>
      <div ref={railRef} className="v-home-news" onScroll={handleScroll}>
        {children}
      </div>

      <div className="v-home-dots">
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            data-on={index === active ? "true" : "false"}
            aria-label={`Show news ${index + 1} of ${count}`}
            aria-current={index === active}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </>
  );
}
