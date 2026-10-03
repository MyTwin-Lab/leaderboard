import type { ReactNode } from "react";

/**
 * Les pictogrammes de `Benchmark Vitrine.dc.html`.
 *
 * La maquette les pose en SVG encodés dans une `data:` URI, trait figé à
 * `#3FA1AA`. Ils sont rendus en SVG inline à la place — même dessin, même
 * grille de 24 —, comme ceux de `/vision` : le trait suit `--v-accent`, et la
 * page ne paie pas une requête par pastille.
 */
export type BenchmarkIconName =
  | "person"
  | "data"
  | "model"
  | "bars"
  | "doc"
  | "refresh"
  | "loop"
  | "clock"
  | "layers"
  | "shield"
  | "target"
  | "lock";

const PATHS: Record<BenchmarkIconName, ReactNode> = {
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1-4 4-6 7-6s6 2 7 6" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
  model: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6" />
    </>
  ),
  bars: <path d="M6 20v-5M12 20V10M18 20V4" />,
  doc: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </>
  ),
  refresh: <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v3.7h-3.7M6 21v-3.7h3.7" />,
  loop: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5" />
    </>
  ),
};

export function BenchmarkIcon({ name }: { name: BenchmarkIconName }) {
  return (
    <svg
      className="v-bm-icon"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** La flèche des boutons et du fil « personne → données → … ». */
export function BenchmarkArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h10m0 0L9 4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
