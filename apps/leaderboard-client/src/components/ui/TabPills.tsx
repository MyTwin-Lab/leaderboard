"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface TabPill {
  label: string;
  count?: number;
}

/**
 * Pill segmented control: the selected tab sits filled instead of underlined,
 * and the fill slides between tabs on change.
 *
 * Both fill colours come from theme tokens rather than white/black, so the
 * contrast inverts on its own — a dark pill in light mode, a light pill in dark
 * mode. Hardcoding them would break light mode, where globals.css only rewrites
 * `bg-white/<opacity>` and `text-white`, leaving a white pill on a white page.
 */
export function TabPills({ tabs, active, onChange, className }: {
  tabs: TabPill[];
  active: number;
  onChange: (index: number) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Null until measured — on the server, and on the very first client paint,
  // there is no geometry to place the fill with. The active tab keeps ordinary
  // text colour until then, so it never renders inverted with no pill under it.
  const [fill, setFill] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const button = buttonRefs.current[active];
      if (!button) return;
      setFill({
        left: button.offsetLeft,
        top: button.offsetTop,
        width: button.offsetWidth,
        height: button.offsetHeight,
      });
    };

    measure();

    // Labels reflow when the container resizes or a webfont lands, either of
    // which leaves the fill sitting under the wrong tab.
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    buttonRefs.current.forEach(button => button && observer.observe(button));
    return () => observer.disconnect();
  }, [active, tabs.length]);

  return (
    <div className={`overflow-x-auto ${className ?? ""}`}>
      <div
        ref={listRef}
        className="relative inline-flex w-max gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
      >
        {/* Sliding fill, drawn under the labels. Animating one shared element
            is what makes the change read as movement; per-button backgrounds
            could only cross-fade. */}
        {fill && (
          <span
            aria-hidden
            className="absolute left-0 top-0 rounded-full transition-[transform,width] duration-300 ease-out"
            style={{
              background: "var(--foreground)",
              width: fill.width,
              height: fill.height,
              transform: `translate(${fill.left}px, ${fill.top}px)`,
            }}
          />
        )}

        {tabs.map((tab, i) => {
          const isActive = active === i;
          const isFilled = isActive && fill !== null;
          return (
            <button
              key={i}
              ref={el => { buttonRefs.current[i] = el; }}
              onClick={() => onChange(i)}
              className={`relative z-10 shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-[color,opacity] duration-300 focus-visible:outline-none ${
                isActive ? "" : "opacity-50 hover:opacity-80"
              }`}
              style={{ color: isFilled ? "var(--background)" : "var(--foreground)" }}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && (
                  // On the filled tab the usual translucent-white chip would
                  // wash out, so it flips to the pill's own colours.
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-normal ${isFilled ? "" : "bg-white/8 text-white/40"}`}
                    style={isFilled ? { background: "var(--background)", color: "var(--foreground)" } : undefined}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
