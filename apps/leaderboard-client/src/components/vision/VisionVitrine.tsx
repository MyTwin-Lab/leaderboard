import Link from "next/link";

import { vitrineFontVars } from "@/components/vitrine/fonts";

import "@/components/vitrine/vitrine.css";
import "./vision-vitrine.css";

/**
 * La page vision, d'après `Vision Redesign Vitrine.dc.html`.
 *
 * La maquette porte sa propre navbar, son propre pied de page et un
 * commutateur PC/téléphone. Aucun des trois n'est repris : `LabShell` pose
 * déjà le chrome pour toute l'app, et le commutateur est un outil de la
 * maquette, pas un élément de la page.
 *
 * Les couleurs non plus ne sont pas reprises : la maquette les fige
 * (#fbfaf8, #0b7a64), la page lit les jetons `--v-*` du repo. Le reste —
 * wording, polices, mesures, masques, mélanges — est celui de la maquette,
 * à l'identique.
 *
 * La figure est l'image du repo (`digital-twin-anatomy-desktop.jpeg`, la
 * version entière) et non le PNG de la maquette : c'est le même sujet, dans
 * un rapport très proche (0.907 contre 0.931), et l'app la sert déjà.
 */

/** La figure, servie six fois sur la page — une seule requête réseau. */
const TWIN = "/home/twin/digital-twin-anatomy-desktop.jpeg";

const SOURCES = [
  {
    name: "Medical history",
    paths: (
      <>
        <path d="M12 5h17l9 9v29H12z" />
        <path d="M29 5v9h9" />
        <path d="M20 15v8m-4-4h8" />
        <path d="M18 30h14m-14 5h14m-14 5h9" />
      </>
    ),
  },
  {
    name: "Imaging",
    paths: (
      <>
        <path d="M14 38V22a14 14 0 0 1 28 0v16z" />
        <circle cx="28" cy="24" r="6" />
        <path d="M4 32h22v6H4z" />
        <path d="M8 38v4m14-4v4" />
      </>
    ),
  },
  {
    name: "Biology",
    paths: (
      <>
        <path d="M15 4c0 10 18 14 18 20S15 34 15 44" />
        <path d="M33 4c0 10-18 14-18 20s18 10 18 20" />
        <path d="M18 10h12m-14 6h16m-16 16h16m-14 6h12" />
      </>
    ),
  },
  {
    name: "Lifestyle",
    paths: (
      <>
        <circle cx="30" cy="8" r="3.5" />
        <path d="M20 18l7-4 5 7 6 3" />
        <path d="M27 14l-4 12 7 6-2 11" />
        <path d="M23 26l-5 8H9" />
        <path d="M20 18l-6 2-3 6" />
      </>
    ),
  },
  {
    name: "Environment",
    paths: (
      <>
        <circle cx="21" cy="24" r="16" />
        <path d="M5 24h32M21 8c-5 5-5 27 0 32m0-32c5 5 5 27 0 32" />
        {/* La feuille masque le globe qu'elle recouvre : elle prend le fond de
            la carte, sinon les méridiens la traversent. */}
        <path d="M44 26c0 9-7 14-15 14 0-9 6-15 15-14z" fill="var(--v-surface)" />
        <path d="M30 39l8-8" />
      </>
    ),
  },
];

const SCALES = [
  { label: "Organs", note: "Heart, lungs, systems", src: "/vision/scales/sc-organs.png" },
  { label: "Tissues", note: "Structure and function", src: "/vision/scales/sc-tissues.png" },
  { label: "Cells", note: "Behaviour and signals", src: "/vision/scales/sc-cells.png" },
  { label: "Molecules", note: "Genes and proteins", src: "/vision/scales/sc-molecules.png" },
];

function StepHead({ num, title, sub }: { num: string; title: string; sub: string }) {
  return (
    <div className="v-vi-step-head">
      <span className="v-vi-num">{num}</span>
      <div className="v-vi-step-text">
        <h2 className="v-vi-step-title">{title}</h2>
        <p className="v-vi-step-sub">{sub}</p>
      </div>
    </div>
  );
}

function ArrowRight({ className }: { className?: string }) {
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

export function VisionVitrine() {
  return (
    <div className={`vitrine v-vision ${vitrineFontVars}`}>
      <div className="v-vi-main">
        {/* ── L'intro ───────────────────────────────────────────────────── */}
        <section className="v-vi-intro" aria-labelledby="vision-title">
          <Link href="/" className="v-vi-back">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M13 8H3m0 0 4-4M3 8l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to the Lab
          </Link>
          <span className="v-vi-eyebrow">Our research vision</span>
          {/* Le retour à la ligne est celui de la maquette PC ; la maquette
              téléphone n'en a pas, et la feuille le masque sous 768px. */}
          <h1 id="vision-title" className="v-vi-title">
            One person.
            <br />
            One evolving digital twin.
          </h1>
          <p className="v-vi-lede">
            Our ambition: connect health data and scientific models to represent each person over
            time.
          </p>
        </section>

        {/* ── 01 · Les sources ──────────────────────────────────────────── */}
        <section className="v-vi-step" aria-labelledby="vision-connect">
          <StepHead
            num="01"
            title="Connect the whole picture"
            sub="Medical history, imaging, biology, lifestyle and environment."
          />
          <ul className="v-vi-sources">
            {SOURCES.map((source) => (
              <li key={source.name} className="v-vi-source">
                <svg
                  viewBox="0 0 48 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {source.paths}
                </svg>
                <span className="v-vi-source-name">{source.name}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 02 · Les échelles ─────────────────────────────────────────── */}
        <section className="v-vi-step" aria-labelledby="vision-scales">
          <StepHead
            num="02"
            title="From the body to the molecule"
            sub="Bringing multiple scales into one connected representation."
          />
          <div className="v-vi-scales">
            <div className="v-vi-figure">
              {/* eslint-disable-next-line @next/next/no-img-element -- masque,
                  `mix-blend-mode` et empilement absolu plus bas : le conteneur
                  que `next/image` ajoute casse les trois. */}
              <img
                src={TWIN}
                alt="Human anatomy blending into a data representation"
                width={1194}
                height={1317}
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <ol className="v-vi-scale-list">
              {SCALES.map((scale) => (
                <li key={scale.label} className="v-vi-scale">
                  {/* Masqué sur téléphone, où la maquette ne relie plus. */}
                  <span aria-hidden="true" className="v-vi-scale-link" />
                  <span className="v-vi-scale-shot">
                    {/* eslint-disable-next-line @next/next/no-img-element -- voir plus haut */}
                    <img src={scale.src} alt="" width={396} height={396} decoding="async" />
                  </span>
                  <span className="v-vi-scale-text">
                    <span className="v-vi-scale-name">{scale.label}</span>
                    <span className="v-vi-scale-note">{scale.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 03 · Le temps ─────────────────────────────────────────────── */}
        <section className="v-vi-step" aria-labelledby="vision-time">
          <StepHead
            num="03"
            title="Understand change over time"
            sub="Explore scenarios, compare hypotheses and study how health may evolve."
          />
          <div className="v-vi-time">
            <figure className="v-vi-moment">
              <div className="v-vi-moment-shot" data-when="past">
                {/* eslint-disable-next-line @next/next/no-img-element -- voir plus haut */}
                <img src={TWIN} alt="" decoding="async" />
              </div>
              <figcaption className="v-vi-moment-label" data-when="past">
                Past
              </figcaption>
            </figure>

            <ArrowRight className="v-vi-arrow" />

            <figure className="v-vi-moment">
              <div className="v-vi-moment-shot" data-when="present">
                {/* eslint-disable-next-line @next/next/no-img-element -- voir plus haut */}
                <img src={TWIN} alt="" decoding="async" />
              </div>
              <figcaption className="v-vi-moment-label" data-when="present">
                Present
              </figcaption>
            </figure>

            <ArrowRight className="v-vi-arrow" />

            <figure className="v-vi-moment">
              {/* Trois copies décalées : la plus pâle est la plus lointaine. */}
              <div className="v-vi-futures">
                {(["far", "mid", "near"] as const).map((depth) => (
                  // eslint-disable-next-line @next/next/no-img-element -- voir plus haut
                  <img key={depth} src={TWIN} alt="" data-depth={depth} decoding="async" />
                ))}
              </div>
              <figcaption className="v-vi-moment-label" data-when="futures">
                Possible futures
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── Le bandeau d'appel ────────────────────────────────────────── */}
        <section className="v-vi-cta" aria-labelledby="vision-cta">
          <div className="v-vi-cta-text">
            <h2 id="vision-cta" className="v-vi-cta-title">
              A vision we build together.
            </h2>
            <p className="v-vi-cta-sub">
              These capabilities are research goals, developed and evaluated step by step.
            </p>
          </div>
          <Link href="/challenges" className="v-vi-cta-link">
            Contribute to the Lab
            <ArrowRight />
          </Link>
        </section>
      </div>
    </div>
  );
}
