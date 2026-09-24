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

/**
 * Les six dimensions de « What can change over time? ».
 *
 * La maquette pose les pastilles en SVG encodés dans une `data:` URI, avec
 * leur trait figé à `#3FA1AA`. Ils sont rendus en SVG inline à la place —
 * même dessin, même grille de 24, mais le trait suit `--v-accent` comme les
 * cinq sources plus haut, et l'app ne paie pas six requêtes de plus.
 */
const CHANGES = [
  {
    title: "Risk profiles",
    text: "Track cardiovascular, metabolic and other health risk trajectories.",
    src: "/vision/changes/risk.jpg",
    width: 360,
    height: 224,
    paths: (
      <>
        <path d="M12 20s-8-4.5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.5 12 20 12 20z" />
        <path d="M6 12h3l1.5-2.5 2 4.5 1.5-2H18" />
      </>
    ),
  },
  {
    title: "Biological age",
    text: "Monitor how your biological age and key indicators may evolve over time.",
    src: "/vision/changes/bioage.jpg",
    width: 364,
    height: 224,
    paths: (
      <>
        <rect x="4" y="13" width="3.5" height="6" rx="0.5" />
        <rect x="10.25" y="9" width="3.5" height="10" rx="0.5" />
        <rect x="16.5" y="5" width="3.5" height="14" rx="0.5" />
      </>
    ),
  },
  {
    title: "Biomarkers",
    text: "Visualize changes across biological and physiological signals.",
    src: "/vision/changes/biomarkers.jpg",
    width: 360,
    height: 224,
    paths: <path d="M12 3.5s-6 6.5-6 10.5a6 6 0 0 0 12 0c0-4-6-10.5-6-10.5z" />,
  },
  {
    title: "Organs & anatomy",
    text: "Detect and visualize anatomical changes through longitudinal 3D models.",
    src: "/vision/changes/organs.jpg",
    width: 360,
    height: 224,
    paths: (
      <>
        <path d="M12 3l4 2.3v4.6L12 12 8 9.9V5.3z" />
        <path d="M8 9.9l4 2.1v4.6l-4 2.3-4-2.3v-4.6z" />
        <path d="M16 9.9l4 2.1v4.6l-4 2.3-4-2.3" />
      </>
    ),
  },
  {
    title: "Disease risk",
    text: "Estimate how the risk of specific conditions may evolve.",
    src: "/vision/changes/disease.jpg",
    width: 360,
    height: 224,
    paths: <path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z" />,
  },
  {
    title: "Possible scenarios",
    text: "Explore how different interventions or behaviors could influence future trajectories.",
    src: "/vision/changes/scenarios.jpg",
    width: 360,
    height: 224,
    paths: (
      <>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="18" cy="18" r="2" />
        <circle cx="12" cy="12" r="1.6" />
        <path d="M7.4 16.6l3.5-3.5M13.1 10.9l3.5-3.5M13.1 13.1l3.5 3.5M6 6l4.8 4.8" />
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
          {/* `#lab` renvoie à l'accueil *derrière* la prépage, là où « Enter
              the lab » mène : on revient d'où l'on vient, pas à la porte. */}
          <Link href="/#lab" className="v-vi-back">
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
            Our ambition: turn health data and scientific models into predictive, preventive,
            personalized and proactive health for each person.
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

        {/* ── Les six dimensions ────────────────────────────────────────── */}
        <section className="v-vi-changes" aria-labelledby="vision-changes">
          <div className="v-vi-changes-head">
            <h2 id="vision-changes" className="v-vi-changes-title">
              What can change over time?
            </h2>
            <p className="v-vi-changes-sub">
              The digital twin enables a deeper understanding of how your health may evolve, across
              multiple dimensions.
            </p>
          </div>
          <ul className="v-vi-change-list">
            {CHANGES.map((change) => (
              <li key={change.title} className="v-vi-change">
                {/* Sur PC la pastille et la vignette se partagent une grille de
                    deux colonnes ; sur téléphone la vignette prend toute la
                    carte et la pastille se pose dessus, en haut à gauche. */}
                <div className="v-vi-change-media">
                  <span className="v-vi-change-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {change.paths}
                    </svg>
                  </span>
                  <div className="v-vi-change-shot">
                    {/* eslint-disable-next-line @next/next/no-img-element -- voir plus haut */}
                    <img
                      src={change.src}
                      alt=""
                      width={change.width}
                      height={change.height}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
                <h3 className="v-vi-change-title">{change.title}</h3>
                <p className="v-vi-change-text">{change.text}</p>
              </li>
            ))}
          </ul>
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
