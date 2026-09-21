import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

import { ArrowIcon } from "./ArrowIcon";
import { MyKineVisual } from "./MyKineVisual";
import { Reveal } from "./Reveal";

// Les articles de la landing sont choisis, pas « les derniers » : chacun porte
// une dimension du Lab (le moteur, l'accessibilité, la communauté, les
// partenaires). Le texte est écrit pour la landing, pas repris des articles.
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

function ContributionLoopVisual() {
  return (
    <div className="l-loop">
      <div className="l-loop__step">
        <span className="l-loop__index">1</span>
        <div>
          <p className="l-loop__label">Tracked</p>
          <p className="l-loop__value">Model submitted to a challenge</p>
        </div>
      </div>
      <div className="l-loop__step">
        <span className="l-loop__index">2</span>
        <div>
          <p className="l-loop__label">Evaluated</p>
          <p className="l-loop__value">Scored on published criteria</p>
          <div className="l-loop__meter">
            <span />
          </div>
        </div>
      </div>
      <div className="l-loop__step l-loop__step--reward">
        <span className="l-loop__index">3</span>
        <div>
          <p className="l-loop__label">Rewarded</p>
          <p className="l-loop__cp">+240 CP</p>
        </div>
      </div>
    </div>
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

const APP_ICON_ROWS = [
  [1, 6, 3, 8, 5, 2, 9],
  [7, 4, 10, 1, 6, 3, 8],
] as const;

function PartnerAppsVisual() {
  return (
    <div className="l-apps" aria-hidden>
      {APP_ICON_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="l-apps__row">
          {row.map((icon, index) => (
            <Image key={`${icon}-${index}`} src={`/home/app-icons/app-icon-${icon}.webp`} alt="" width={168} height={168} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LandingNews() {
  return (
    <section className="l-section" aria-labelledby="landing-news-title">
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
              <ReadMore>Read the story</ReadMore>
            </div>
            <div className="l-feature__visual" aria-hidden>
              <ContributionLoopVisual />
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
                <p className="l-eyebrow">Accessibility</p>
                <h3 className="l-heading l-card__title">Designing a health app with our eyes closed</h3>
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
                <PartnerAppsVisual />
              </div>
              <div className="l-card__body">
                <p className="l-eyebrow">Partnerships</p>
                <h3 className="l-heading l-card__title">The best health technologies, in a single app</h3>
                <p className="l-card__text">
                  From AI skin checks to vital signs read by a camera, MyTwin brings partner technologies together
                  in one application. Each integration starts in the Lab.
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
