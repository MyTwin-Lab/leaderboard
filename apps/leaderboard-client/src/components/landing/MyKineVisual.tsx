"use client";

import { useEffect, useRef } from "react";

type Point = readonly [number, number];

// Deux poses vues de profil, [debout, squat] : la silhouette que l'estimation
// de pose reconstruit à partir de la caméra du téléphone.
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

export function MyKineVisual() {
  const svgRef = useRef<SVGSVGElement>(null);

  // Les animations SMIL ignorent `prefers-reduced-motion` : on les fige à la main.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      svgRef.current?.pauseAnimations();
    }
  }, []);

  return (
    <div className="l-kine" aria-hidden>
      <svg ref={svgRef} viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" fill="none">
        <line x1="60" y1="226" x2="260" y2="226" stroke="currentColor" strokeOpacity="0.18" />

        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9">
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

        <g fill="#0af7c1">
          {Object.entries(JOINTS).map(([name, [from, to]]) => (
            <circle key={name} cx={from[0]} cy={from[1]} r="3.5">
              <Tween attribute="cx" from={from[0]} to={to[0]} />
              <Tween attribute="cy" from={from[1]} to={to[1]} />
            </circle>
          ))}
        </g>
      </svg>

      <div className="l-kine__chip" style={{ top: "1.25rem", left: "1.25rem" }}>
        <small>Reps</small>
        08 / 12
      </div>
      <div className="l-kine__chip" style={{ right: "1.25rem", bottom: "1.25rem" }}>
        <small>Knee flexion</small>
        94°
      </div>
    </div>
  );
}
