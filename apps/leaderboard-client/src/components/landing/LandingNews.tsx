import type { CSSProperties, ReactNode } from "react";

import { ArrowIcon } from "./ArrowIcon";
import { CameraCheckupVisual } from "./CameraCheckupVisual";
import { LandingTopContributors } from "./LandingTopContributors";
import { MyKineVisual } from "./MyKineVisual";
import { Reveal } from "./Reveal";

// Les articles de la landing sont choisis, pas « les derniers » : chacun porte
// une dimension du Lab (le moteur, l'accessibilité, la communauté, une
// intégration partenaire). Le texte est écrit pour la landing, pas repris des
// articles.
//
// « Read … » n'est pas encore un lien : le branchement sur les articles
// (existants, à adapter ou à écrire) vient après la landing.
function ReadMore({ children }: { children: ReactNode }) {
  return (
    <span className="l-more">
      {children}
      <ArrowIcon />
    </span>
  );
}

const SCREEN_READER_ROWS = [
  ["Heading", "My health"],
  ["Button", "Add a measurement"],
  ["Menu", "Records, 6 items"],
  ["Link", "Blood test results"],
  ["Button", "Share with my doctor"],
] as const;

function AccessibilityVisual() {
  return (
    <div className="l-a11y" aria-hidden>
      <div className="l-a11y__list">
        <div className="l-a11y__focus" />
        {SCREEN_READER_ROWS.map(([role, label]) => (
          <div key={label} className="l-a11y__row">
            <span>{role}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="l-a11y__voice">
        <div className="l-wave">
          {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
            <i key={bar} style={{ "--i": bar } as CSSProperties} />
          ))}
        </div>
        “Show me my last blood test”
      </div>
    </div>
  );
}

export function LandingNews() {
  return (
    <section className="l-section l-news" aria-labelledby="landing-news-title">
      <div className="l-container">
        <Reveal className="l-section__head">
          <h2 id="landing-news-title" className="l-heading l-section__title">
            MyTwin Lab News
          </h2>
        </Reveal>

        <Reveal>
          <article className="l-feature">
            <div className="l-feature__body">
              <p className="l-eyebrow">The Leaderboard · Public beta</p>
              <h3 className="l-heading l-feature__title">
                Every contribution tracked, evaluated and <em>rewarded</em>
              </h3>
              <p className="l-feature__text">
                The Leaderboard is the heart of MyTwin Lab. Take on a health challenge, or bring your own project to
                the Sandbox: your work is evaluated against criteria published in advance, and credited in
                contribution points. Anyone can join, and help build the world’s most advanced human digital twin.
              </p>
              <dl className="l-feature__facts">
                <div className="l-feature__fact">
                  <dt>Challenges</dt>
                  <dd>Code, machine learning and clinical validation</dd>
                </div>
                <div className="l-feature__fact">
                  <dt>Evaluation</dt>
                  <dd>The same published rules for everyone, human review on request</dd>
                </div>
                <div className="l-feature__fact">
                  <dt>Recognition</dt>
                  <dd>Contribution points (CP), visible on a public leaderboard</dd>
                </div>
              </dl>
              <ReadMore>Read more</ReadMore>
            </div>
            <div className="l-feature__visual">
              <LandingTopContributors />
            </div>
          </article>
        </Reveal>

        <div className="l-cards">
          <Reveal>
            <article className="l-card">
              <div className="l-card__visual">
                <AccessibilityVisual />
              </div>
              <div className="l-card__body">
                <p className="l-eyebrow">MyTwin Accessibility Challenge</p>
                <h3 className="l-heading l-card__title">
                  Designing an app for visually impaired users was harder than we thought
                </h3>
                <p className="l-card__text">
                  Accessibility is not a layer of labels added at the end. Rethinking MyTwin for people who cannot
                  see the screen sent us back to the fundamentals of the product, and towards an app you can drive
                  entirely by voice.
                </p>
                <ReadMore>Read more</ReadMore>
              </div>
            </article>
          </Reveal>

          <Reveal delay={120}>
            <article className="l-card">
              <div className="l-card__visual">
                <MyKineVisual />
              </div>
              <div className="l-card__body">
                <p className="l-eyebrow">Sandbox · Community project</p>
                <h3 className="l-heading l-card__title">MyKine turns a phone camera into a physio’s measuring tool</h3>
                <p className="l-card__text">
                  Proposed by a contributor in the Sandbox: guided physiotherapy sessions that count reps and measure
                  joint angles at home, without a single image leaving the device.
                </p>
                <ReadMore>Read more</ReadMore>
              </div>
            </article>
          </Reveal>

          <Reveal delay={240}>
            <article className="l-card">
              <div className="l-card__visual">
                <CameraCheckupVisual />
              </div>
              <div className="l-card__body">
                <p className="l-eyebrow">Partner integration · i-Virtual</p>
                <h3 className="l-heading l-card__title">Check your cardiovascular health with your smartphone camera</h3>
                <p className="l-card__text">
                  MyTwin has integrated i-Virtual’s check-up into its mobile app, now in private beta. A 30-second
                  selfie video is enough to estimate your heart rate, breathing rate, stress level and a cardiovascular
                  health score. No watch, no cuff, no sensor.
                </p>
                <ReadMore>Read more</ReadMore>
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
