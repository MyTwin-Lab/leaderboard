"use client";

import { useEffect, useRef } from "react";

// La silhouette que l'estimation de pose reconstruit à partir de la caméra du
// téléphone, pendant un squat. Les deux relevés (répétitions, flexion du genou)
// sont ceux d'une séance fictive : ils montrent ce que MyKine mesure.
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

function Tween({ attribute, from, to }: { attribute: string; from: number; to: number }) {
  return (
    <animate
      attributeName={attribute}
      values={`${from};${to};${to};${from};${from}`}
      keyTimes="0;0.36;0.5;0.86;1"
      calcMode="spline"
      keySplines="0.45 0 0.2 1;0 0 1 1;0.45 0 0.2 1;0 0 1 1"
      dur="5s"
      repeatCount="indefinite"
    />
  );
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

  // Les animations SMIL ignorent `prefers-reduced-motion` : on les fige à la main.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      svgRef.current?.pauseAnimations();
    }
  }, []);

  return (
    <div
      className="relative size-full"
      style={{ background: `radial-gradient(70% 60% at 50% 40%, rgb(255 255 255 / 0.07), transparent 70%), ${PANEL}` }}
    >
      {/* Cadré en 16:10, le format des cartes : de la tête au sol. */}
      <svg
        ref={svgRef}
        viewBox="-16 18 352 220"
        preserveAspectRatio="xMidYMid slice"
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

      <Chip label="Reps" value="08 / 12" className="top-[1.4em] left-[1.4em]" />
      <Chip label="Knee flexion" value="94°" className="right-[1.4em] bottom-[1.4em]" />
    </div>
  );
}
