import { HomeArrow } from "./HomeSection";

/**
 * « The human digital twin » : la figure d'un côté, les trois étapes de
 * l'autre.
 *
 * Les étapes sont numérotées et reliées par un pointillé parce qu'elles le
 * sont vraiment — connecter, modéliser, simuler est une suite, chacune
 * n'existant qu'une fois la précédente faite.
 */
const STEPS = [
  {
    title: "Connect health data",
    body: "Records, sensors and imaging brought into one consented, patient-owned picture.",
  },
  {
    title: "Build evolving models",
    body: "Open-source models, trained and validated through the Lab’s challenges.",
  },
  {
    title: "Explore possible futures",
    body: "Simulate what could happen next, and act before it does.",
  },
];

export function HomeVision() {
  return (
    <section className="v-home-vision" aria-labelledby="vision-title">
      <div className="v-home-vision-left">
        <div className="v-home-vision-head">
          <h2 id="vision-title" className="v-home-vision-title">
            The human digital twin
          </h2>
          <p className="v-home-vision-sub">Our research vision</p>
        </div>

        {/* Deux fichiers plutôt qu'un seul recadré par le CSS : la version
            téléphone est déjà rognée sur le buste, la version PC est entière.
            Un <picture> et non <Image> — Next ne sait pas changer de fichier
            selon la largeur, et deux <Image> dont un caché en téléchargeraient
            deux. On renonce donc à l'optimisation pour n'en charger qu'un.

            L'image porte ce que le titre ne dit pas — l'anatomie qui se dissout
            en points de données — donc un vrai texte alternatif, pas un
            `aria-hidden`. */}
        <div className="v-home-twin">
          <picture>
            <source
              media="(min-width: 768px)"
              srcSet="/home/twin/digital-twin-anatomy-desktop.jpeg"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- art direction, voir ci-dessus */}
            <img
              src="/home/twin/digital-twin-anatomy.jpg"
              alt="A human digital twin: anatomy on one side, dissolving into data points on the other"
              width={891}
              height={808}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </div>
      </div>
      <div className="v-home-vision-right">
        <ol className="v-home-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="v-home-step">
              <div className="v-home-step-mark">
                <span className="v-home-step-num">{String(index + 1).padStart(2, "0")}</span>
                {/* Pas de trait après la dernière : il ne mènerait nulle part. */}
                {index < STEPS.length - 1 && (
                  <span aria-hidden="true" className="v-home-step-link" />
                )}
              </div>
              <div className="v-home-step-body">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <a href="https://mytwin.care" className="v-home-more v-home-vision-link">
          Explore the vision
          <HomeArrow corner />
        </a>
      </div>
    </section>
  );
}
