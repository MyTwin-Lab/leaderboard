import { BenchmarkRadar, BenchmarkScores } from "@/components/benchmark/BenchmarkRadar";

import { HomeMore } from "./HomeSection";

/**
 * « Benchmark » : l'aperçu du cadre de maturité, qui mène à `/benchmark`.
 *
 * C'est la seule entrée vers cette page — elle n'est pas dans la navbar. Le
 * radar et les jauges sont ceux de la page elle-même (`BenchmarkRadar`).
 *
 * `HomeSectionHead` n'est pas réutilisé : ici la maquette pose un vrai titre,
 * en gras et à l'encre, entre le sur-titre et l'accroche grise.
 */
export function HomeBenchmark() {
  return (
    <section aria-labelledby="bench-title" className="v-home-section v-home-bench">
      <div className="v-home-bench-head">
        <span className="v-home-eyebrow">Benchmark</span>
        <h2 id="bench-title" className="v-home-bench-title">
          How advanced is a human digital twin?
        </h2>
        {/* Le cadre téléphone de la maquette raccourcit l'accroche. */}
        <p className="v-home-bench-sub">
          <span className="v-bm-only-desktop">Explore our</span>
          <span className="v-bm-only-phone">Our</span> open framework to measure the maturity of
          human digital twins.
        </p>
      </div>

      <div className="v-home-bench-card">
        <div className="v-home-bench-radar">
          <BenchmarkRadar label="Radar chart of the six maturity dimensions" />
          {/* La moyenne des six jauges, au centre de la silhouette : sur
              téléphone le radar n'a plus ses libellés. */}
          <span className="v-home-bench-overall">
            <b>70%</b>
            <small>Overall</small>
          </span>
        </div>
        <div className="v-home-bench-side">
          <BenchmarkScores />
          <HomeMore href="/benchmark">Explore the benchmark</HomeMore>
        </div>
      </div>

      <HomeMore href="/benchmark" place="bottom">
        Explore the benchmark
      </HomeMore>
    </section>
  );
}
