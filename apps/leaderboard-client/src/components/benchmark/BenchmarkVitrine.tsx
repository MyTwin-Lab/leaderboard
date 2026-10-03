import Link from "next/link";

import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { bookingPath } from "@/lib/booking";

import { BenchmarkDimensions } from "./BenchmarkDimensions";
import { BenchmarkRadar, BenchmarkScores } from "./BenchmarkRadar";
import { BenchmarkArrow, BenchmarkIcon, type BenchmarkIconName } from "./icons";

import "@/components/vitrine/vitrine.css";
import "./benchmark-vitrine.css";

/**
 * La page benchmark, d'après `Benchmark Vitrine.dc.html`.
 *
 * Comme pour `/vision`, la navbar, le pied de page et le commutateur
 * PC/téléphone de la maquette ne sont pas repris — `LabShell` pose le chrome —
 * et les couleurs sont celles des jetons `--v-*` du repo. Les deux cadres de la
 * maquette sont rendus par un seul balisage ; les écarts sont dans la feuille,
 * sous `@media (max-width: 767px)`.
 *
 * La figure est l'image que `/vision` sert déjà
 * (`digital-twin-anatomy-desktop.jpeg`), pas le PNG de la maquette : même
 * sujet, et une seule image pour les deux cadres.
 *
 * « Submit a twin » et « Join the Scientific Committee » mènent à la prise de
 * rendez-vous, chacun avec son intention (`/book?for=…`) : deux parcours, deux
 * sources CRM — celui qui soumet un twin n'est pas celui qui les évalue.
 */

const TWIN = "/home/twin/digital-twin-anatomy-desktop.jpeg";

const STATS = [
  { value: "10", label: "Dimensions of maturity" },
  { value: "0–100", label: "HDT maturity score" },
  { value: "Open", label: "Methodology and data" },
];

const FLOW: { icon: BenchmarkIconName; title: string; text: string }[] = [
  { icon: "person", title: "Person", text: "A real individual" },
  { icon: "data", title: "Data", text: "Multimodal data" },
  { icon: "model", title: "Model", text: "Personalized models" },
  { icon: "bars", title: "Prediction", text: "Individualized predictions" },
  { icon: "doc", title: "Decision", text: "Actionable insights" },
  { icon: "person", title: "Person", text: "Improved outcomes" },
];

const TRAITS: { icon: BenchmarkIconName; title: string; text: string }[] = [
  { icon: "person", title: "Personalized", text: "Tailored to one individual" },
  { icon: "refresh", title: "Dynamic", text: "Continuously updated" },
  { icon: "bars", title: "Predictive", text: "Forecasts future states" },
  { icon: "doc", title: "Decision-supporting", text: "Informs actions" },
  { icon: "loop", title: "Feedback loop", text: "Learns from outcomes" },
];

export function BenchmarkVitrine() {
  return (
    <div className={`vitrine v-benchmark ${vitrineFontVars}`}>
      <div className="v-bm-main">
        {/* Absent de la maquette, qui porte une navbar où la page figure ;
            ici elle n'y est pas, d'où le même retour que les autres vitrines. */}
        <BackToLab />

        {/* ── L'intro ───────────────────────────────────────────────────── */}
        <section className="v-bm-hero" aria-labelledby="benchmark-title">
          <div className="v-bm-hero-text">
            <span className="v-bm-eyebrow">Benchmark</span>
            <h1 id="benchmark-title" className="v-bm-title">
              An open, evidence-based framework to measure the maturity of human digital twins.
            </h1>
            <p className="v-bm-lede">
              We created an open framework to evaluate what makes a true human digital twin, and how
              advanced it is.
            </p>
            <Link href={bookingPath("benchmark-submission")} className="v-bm-submit">
              Submit a twin
              <BenchmarkArrow />
            </Link>
            <dl className="v-bm-stats">
              {STATS.map((stat) => (
                <div key={stat.label} className="v-bm-stat">
                  <dt>{stat.value}</dt>
                  <dd>{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
          {/* Sur PC, la figure tient la seconde colonne ; sur téléphone elle
              passe derrière le titre, en filigrane. */}
          <div className="v-bm-figure">
            {/* eslint-disable-next-line @next/next/no-img-element -- masque et
                `mix-blend-mode` : le conteneur de `next/image` casse les deux. */}
            <img
              src={TWIN}
              alt="A human digital twin: anatomy on one side, dissolving into data points on the other"
              width={1194}
              height={1317}
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </section>

        {/* ── Ce qui fait un jumeau ─────────────────────────────────────── */}
        <section className="v-bm-what" aria-labelledby="benchmark-what">
          <h2 id="benchmark-what" className="v-bm-h2">
            What makes a human digital twin?
          </h2>
          <ol className="v-bm-flow">
            {FLOW.map((step, index) => (
              <li key={`${step.title}-${index}`} className="v-bm-flow-step">
                <span className="v-bm-flow-icon">
                  <BenchmarkIcon name={step.icon} />
                </span>
                <h3 className="v-bm-flow-title">
                  {/* Le téléphone n'a pas la place des flèches : il numérote. */}
                  <span className="v-bm-flow-num v-bm-only-phone">{index + 1} </span>
                  {step.title}
                </h3>
                <p className="v-bm-flow-text">{step.text}</p>
                {index < FLOW.length - 1 && <BenchmarkArrow className="v-bm-flow-arrow" />}
              </li>
            ))}
          </ol>
          <ul className="v-bm-traits">
            {TRAITS.map((trait) => (
              <li key={trait.title} className="v-bm-trait">
                <span className="v-bm-trait-icon">
                  <BenchmarkIcon name={trait.icon} />
                </span>
                <span className="v-bm-trait-body">
                  <b>{trait.title}</b>
                  <span>{trait.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Le niveau de maturité ─────────────────────────────────────── */}
        <section className="v-bm-how" aria-labelledby="benchmark-how">
          <h2 id="benchmark-how" className="v-bm-h2">
            How advanced is it?
          </h2>
          <div className="v-bm-how-grid">
            <figure className="v-bm-radar-card">
              <BenchmarkRadar
                label="Radar chart: a mature human digital twin compared with an early-stage twin"
                earlyStage
              />
              <figcaption className="v-bm-legend">
                <span>
                  <span className="v-bm-legend-dot" data-kind="mature" />
                  <span className="v-bm-only-desktop">Example of a mature human digital twin</span>
                  <span className="v-bm-only-phone">Mature twin</span>
                </span>
                <span>
                  <span className="v-bm-legend-dot" data-kind="early" />
                  <span className="v-bm-only-desktop">Early-stage twin (illustrative)</span>
                  <span className="v-bm-only-phone">Early-stage (illustrative)</span>
                </span>
              </figcaption>
            </figure>
            <BenchmarkScores className="v-bm-scores" />
          </div>
        </section>

        {/* ── Les dix dimensions ────────────────────────────────────────── */}
        <section className="v-bm-dims-section" aria-labelledby="benchmark-dimensions">
          <h2 id="benchmark-dimensions" className="v-bm-h2">
            The 10 dimensions of maturity
          </h2>
          <BenchmarkDimensions />
        </section>

        {/* ── L'appel à contribuer ──────────────────────────────────────── */}
        <section className="v-bm-contribute" aria-labelledby="benchmark-contribute">
          <div className="v-bm-contribute-text">
            <span className="v-bm-eyebrow">Contribute</span>
            <h2 id="benchmark-contribute" className="v-bm-h2">
              Submit your human digital twin
            </h2>
            <p className="v-bm-contribute-sub">
              Researchers, startups, clinics and builders can submit their projects for review.
            </p>
            <Link href={bookingPath("scientific-committee")} className="v-bm-join">
              Join the Scientific Committee
              <BenchmarkArrow />
            </Link>
          </div>
          <div className="v-bm-contribute-shot" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- masque en
                dégradé posé sur le conteneur, voir plus haut. */}
            <img
              src="/home/twin/create-your-twin.webp"
              alt=""
              width={1600}
              height={533}
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
