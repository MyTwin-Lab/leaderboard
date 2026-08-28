'use client';

import { useEffect, useState, type ReactNode } from 'react';

const ROTATE_MS = 3500;

/** Wraps the 3 hero stat cards (CP awarded, metric/tasks, team).
 * Desktop/tablet: unchanged 3-column grid. Phone: auto-rotating carousel,
 * one card visible at a time, looping on its own. */
export function HeroStatCarousel({ cards }: { cards: ReactNode[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (cards.length <= 1) return;
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % cards.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [cards.length]);

  return (
    <>
      {/* Phone: auto-rotating carousel */}
      <div className="overflow-hidden sm:hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {cards.map((card, index) => (
            <div key={index} className="w-full shrink-0">
              {card}
            </div>
          ))}
        </div>
        {cards.length > 1 && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
            {cards.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === active ? 'w-4 bg-brandCP' : 'w-1.5 bg-white/15'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tablet/desktop: static 3-column grid */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-3">
        {cards.map((card, index) => (
          <div key={index}>{card}</div>
        ))}
      </div>
    </>
  );
}
