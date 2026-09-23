import Image from "next/image";

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
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <h2 id="vision-title" className="v-home-vision-title">
            The human digital twin
          </h2>
          <p className="v-home-vision-sub">Our research vision</p>
        </div>

        {/* Décorative : le titre juste au-dessus dit déjà ce qu'elle montre. */}
        <div className="v-home-twin">
          <Image
            src="/home/twin/digital-twin-light.webp"
            alt=""
            aria-hidden
            width={835}
            height={1400}
            sizes="(min-width: 768px) 32rem, 100vw"
            priority
          />
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

        <a href="https://mytwin.care" className="v-home-more" style={{ justifySelf: "start" }}>
          Explore the vision
          <HomeArrow corner />
        </a>
      </div>
    </section>
  );
}
