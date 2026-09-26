"use client";

import { useEffect, useRef, useState } from "react";

import { NewsFigure } from "@/components/news/NewsFigure";

// La silhouette que l'estimation de pose reconstruit à partir de la caméra du
// téléphone, pendant un squat. Les deux relevés suivent le bonhomme : une
// répétition comptée à chaque remontée, par séries de 12, et l'angle du genou
// recalculé à chaque image depuis les articulations affichées.
// Panneau sombre, couleurs fixes : le visuel ne suit pas le thème du Lab.
const PANEL = "#1b2327";
const BONE = "#fff";
const JOINT = "#0af7c1";

type Point = readonly [number, number];

// Deux poses vues de profil, [debout, squat].
const JOINTS = {
  shoulder: [[150, 66], [160, 98]],
  elbow: [[180, 80], [193, 104]],
  wrist: [[210, 80], [225, 100]],
  hip: [[148, 126], [126, 150]],
  knee: [[153, 176], [172, 166]],
  ankle: [[150, 222], [150, 222]],
  toe: [[174, 225], [174, 225]],
} as const satisfies Record<string, readonly [Point, Point]>;

const HEAD: readonly [Point, Point] = [[153, 40], [167, 73]];

const BONES: ReadonlyArray<[keyof typeof JOINTS, keyof typeof JOINTS]> = [
  ["shoulder", "hip"],
  ["hip", "knee"],
  ["knee", "ankle"],
  ["ankle", "toe"],
  ["shoulder", "elbow"],
  ["elbow", "wrist"],
];

// Un squat par boucle : descente, tenue en bas, remontée, pause debout.
const DURATION = 5;
const DOWN_END = 0.36;
const UP_START = 0.5;
const UP_END = 0.86;
const EASE = [0.45, 0, 0.2, 1] as const;
const SET_SIZE = 12;

function Tween({ attribute, from, to }: { attribute: string; from: number; to: number }) {
  return (
    <animate
      attributeName={attribute}
      values={`${from};${to};${to};${from};${from}`}
      keyTimes={`0;${DOWN_END};${UP_START};${UP_END};1`}
      calcMode="spline"
      keySplines={`${EASE.join(" ")};0 0 1 1;${EASE.join(" ")};0 0 1 1`}
      dur={`${DURATION}s`}
      repeatCount="indefinite"
    />
  );
}

// La même courbe de Bézier que `keySplines` : x → y, x résolu par Newton.
function ease(x: number) {
  const [x1, y1, x2, y2] = EASE;
  const bezier = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const slope = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t ** 2;
    if (Math.abs(slope) < 1e-6) break;
    t -= (bezier(t, x1, x2) - x) / slope;
  }
  return bezier(t, y1, y2);
}

// Avancement vers le squat (0 debout, 1 en bas) à un instant de la boucle.
function depth(phase: number) {
  if (phase < DOWN_END) return ease(phase / DOWN_END);
  if (phase < UP_START) return 1;
  if (phase < UP_END) return 1 - ease((phase - UP_START) / (UP_END - UP_START));
  return 0;
}

function kneeFlexion(progress: number) {
  const at = (name: keyof typeof JOINTS) => {
    const [[x0, y0], [x1, y1]] = JOINTS[name];
    return [x0 + (x1 - x0) * progress, y0 + (y1 - y0) * progress];
  };
  const [hx, hy] = at("hip");
  const [kx, ky] = at("knee");
  const [ax, ay] = at("ankle");
  const angle = Math.atan2(hy - ky, hx - kx) - Math.atan2(ay - ky, ax - kx);
  const inner = Math.abs(((angle * 180) / Math.PI + 540) % 360 - 180);
  return Math.round(180 - inner);
}

// La répétition compte à la fin de la remontée ; après la 12e, la série
// repart de zéro au début de la boucle suivante.
function readings(time: number) {
  const loop = Math.floor(time / DURATION);
  const phase = time / DURATION - loop;
  return {
    reps: (loop % SET_SIZE) + (phase >= UP_END ? 1 : 0),
    flexion: kneeFlexion(depth(phase)),
  };
}

function Chip({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div
      className={`absolute grid gap-[0.1em] rounded-[0.8em] border border-[rgb(255_255_255/0.14)] bg-[rgb(13_19_22/0.55)] px-[0.8em] py-[0.5em] text-[1.05em] font-medium leading-tight text-[#fff] backdrop-blur-[8px] ${className}`}
    >
      <small className="text-[0.66em] font-normal uppercase tracking-[0.12em] text-[rgb(255_255_255/0.6)]">
        {label}
      </small>
      {value}
    </div>
  );
}

export function PoseIllustration() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [{ reps, flexion }, setReadings] = useState(() => readings(0));

  // Les animations SMIL ignorent `prefers-reduced-motion` : on les fige à la main.
  // Sinon, les relevés lisent l'horloge du SVG à chaque image, pour rester
  // calés sur le bonhomme.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      svg.pauseAnimations();
      return;
    }
    let frame = requestAnimationFrame(function tick() {
      const next = readings(svg.getCurrentTime());
      setReadings((current) =>
        current.reps === next.reps && current.flexion === next.flexion ? current : next,
      );
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="relative size-full"
      style={{ background: `radial-gradient(70% 60% at 50% 40%, rgb(255 255 255 / 0.07), transparent 70%), ${PANEL}` }}
    >
      {/* De la tête au sol, en entier quel que soit le format du cadre
          (`meet`) : le panneau comble les côtés. */}
      <svg
        ref={svgRef}
        viewBox="-16 16 352 222"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        className="absolute inset-0 size-full"
      >
        <line x1="60" y1="226" x2="260" y2="226" stroke={BONE} strokeOpacity="0.18" />

        <g stroke={BONE} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9">
          {BONES.map(([start, end]) => (
            <line
              key={`${start}-${end}`}
              x1={JOINTS[start][0][0]}
              y1={JOINTS[start][0][1]}
              x2={JOINTS[end][0][0]}
              y2={JOINTS[end][0][1]}
            >
              <Tween attribute="x1" from={JOINTS[start][0][0]} to={JOINTS[start][1][0]} />
              <Tween attribute="y1" from={JOINTS[start][0][1]} to={JOINTS[start][1][1]} />
              <Tween attribute="x2" from={JOINTS[end][0][0]} to={JOINTS[end][1][0]} />
              <Tween attribute="y2" from={JOINTS[end][0][1]} to={JOINTS[end][1][1]} />
            </line>
          ))}
          <circle cx={HEAD[0][0]} cy={HEAD[0][1]} r="13">
            <Tween attribute="cx" from={HEAD[0][0]} to={HEAD[1][0]} />
            <Tween attribute="cy" from={HEAD[0][1]} to={HEAD[1][1]} />
          </circle>
        </g>

        <g fill={JOINT}>
          {Object.entries(JOINTS).map(([name, [from, to]]) => (
            <circle key={name} cx={from[0]} cy={from[1]} r="3.5">
              <Tween attribute="cx" from={from[0]} to={to[0]} />
              <Tween attribute="cy" from={from[1]} to={to[1]} />
            </circle>
          ))}
        </g>
      </svg>

      <Chip label="Reps" value={`${String(reps).padStart(2, "0")} / ${SET_SIZE}`} className="top-[1.4em] left-[1.4em]" />
      <Chip label="Knee flexion" value={`${flexion}°`} className="right-[1.4em] bottom-[1.4em]" />
    </div>
  );
}

// Le même visuel dans le texte, sous l'intro. Il est dessiné en `em` : la
// police suit la largeur du cadre (`cqw`), comme dans `NewsIllustrationFrame`.
export function PoseFigure() {
  return (
    <NewsFigure caption="During a squat, the pose model follows the body, counts each repetition and measures the knee angle.">
      <div aria-hidden className="@container aspect-[16/9] overflow-hidden rounded-[12px]">
        <div className="size-full text-[length:clamp(9px,3.6cqw,16px)]">
          <PoseIllustration />
        </div>
      </div>
    </NewsFigure>
  );
}
