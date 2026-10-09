import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WhatsappLink } from "@/components/join/WhatsappLink";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { JOIN_PATH, JOIN_SHARE_PATH, JOIN_WELCOME_PATH } from "@/lib/join";
import { readLabMember } from "@/lib/server/labMember";
import { pageMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/join/join-vitrine.css";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Welcome to the MyTwin Lab",
    description: "Welcome to the MyTwin Lab community.",
    path: JOIN_WELCOME_PATH,
  }),
  robots: { index: false, follow: true },
};

/**
 * Qui fait quoi dans le Lab : des exemples, pas des boutons. Les seules
 * actions de la page sont les trois premiers pas, au-dessus.
 */
const AUDIENCES = [
  {
    title: "Patients and caregivers",
    items: [
      "Share what you lived through, so the twin helps where it matters first",
      "Take part in the debates and ideation sessions",
      "Try new features before anyone else",
    ],
  },
  {
    title: "Developers and researchers",
    items: [
      "Build the bricks of the human digital twin through open challenges",
      "Propose ideas, and launch your own health project in the Sandbox",
      "Get help from other contributors, and earn points on the leaderboard",
    ],
  },
  {
    title: "Clinicians",
    items: [
      "Bring your field experience to the challenges",
      "Help review the twins submitted to the open benchmark",
      "Shape how the twin fits into real care",
    ],
  },
];

/**
 * `/join/welcome` — l'accueil du nouveau membre.
 *
 * Réservée au membre reconnu par son cookie (`lib/server/labMember.ts`) ;
 * sans lui, retour à `/join`. `?back=1` : l'e-mail était déjà inscrit.
 * `?shared=1` : l'anecdote vient d'être envoyée.
 *
 * Les pas cochés vivent dans le cookie : un membre qui revient des semaines
 * plus tard retrouve sa page telle qu'il l'a laissée.
 */
export default async function JoinWelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await readLabMember();
  if (!member) redirect(JOIN_PATH);

  const params = await searchParams;
  const returning = params.back === "1";
  const justShared = params.shared === "1";
  const shared = member.steps.includes("anecdote");
  const onWhatsapp = member.steps.includes("whatsapp");

  return (
    <div className={`vitrine v-join ${vitrineFontVars}`}>
      <div className="v-main">
        <BackToLab />

        <header className="v-join-hero">
          <span className="v-eyebrow">
            <span className="v-eyebrow-dot" aria-hidden="true" />
            {returning ? "Welcome back" : "You're in"}
          </span>
          <h1 className="v-title v-join-hero-title">
            Welcome to the <em className="v-join-em">MyTwin Lab</em> community
          </h1>
          <p className="v-lede v-join-hero-lede">
            Together, we are building the world&rsquo;s most advanced human digital twin, in the open and step by step,
            to enable predictive, preventive, personalized and proactive health.
          </p>

          <div className="v-join-inbox" role="status">
            <MailIcon />
            {returning ? (
              <p>
                <strong>{member.email} was already on the list.</strong> Nothing new to confirm: our news keeps coming
                to this address.
              </p>
            ) : (
              <p>
                <strong>A welcome email is on its way to {member.email}.</strong> Can&rsquo;t find it? Look in your spam
                or promotions folder and mark it as &ldquo;Not spam&rdquo;, so our next news reaches your inbox.
              </p>
            )}
          </div>
        </header>

        <section className="v-join-section" aria-labelledby="join-steps-title">
          <div className="v-join-section-head">
            <h2 id="join-steps-title" className="v-join-section-title">
              Your first steps
            </h2>
            <p className="v-join-section-sub">Three ways to make your mark on the Lab, in any order.</p>
          </div>

          <ol className="v-join-steps">
            <li className="v-join-step" data-done={shared}>
              <StepMark index={1} done={shared} />
              <h3 className="v-join-step-title">Share your health story</h3>
              <p className="v-join-step-text">
                A doubt, a difficult decision, a complex care journey: your experience shows where the twin should help
                first.
              </p>
              {justShared && <p className="v-join-step-thanks">Thank you, your story is with us.</p>}
              <Link href={JOIN_SHARE_PATH} className="v-join-step-cta" data-quiet={shared}>
                {shared ? "Share another story" : "Share my health anecdote"}
                <ArrowIcon />
              </Link>
            </li>

            <li className="v-join-step" data-done={onWhatsapp}>
              <StepMark index={2} done={onWhatsapp} />
              <h3 className="v-join-step-title">Join the conversation</h3>
              <p className="v-join-step-text">
                Debates, ideas and feedback with patients, clinicians, researchers and developers, on WhatsApp.
              </p>
              <WhatsappLink className="v-join-step-cta" quiet={onWhatsapp}>
                {onWhatsapp ? "Open the community" : "Join the WhatsApp community"}
                <ExternalIcon />
              </WhatsappLink>
            </li>

            <li className="v-join-step">
              <StepMark index={3} done={false} />
              <h3 className="v-join-step-title">Build the twin</h3>
              <p className="v-join-step-text">
                Pick an open challenge and contribute. You will only need an account when you take part.
              </p>
              <Link href="/challenges" className="v-join-step-cta">
                Explore the challenges
                <ArrowIcon />
              </Link>
            </li>
          </ol>
        </section>

        <section className="v-join-section" aria-labelledby="join-audiences-title">
          <div className="v-join-section-head">
            <h2 id="join-audiences-title" className="v-join-section-title">
              Everyone has a place in the Lab
            </h2>
            <p className="v-join-section-sub">A few examples of what members do, whatever brought them here.</p>
          </div>

          <div className="v-join-audiences">
            {AUDIENCES.map((audience) => (
              <article key={audience.title} className="v-join-audience">
                <h3 className="v-join-audience-title">{audience.title}</h3>
                <ul>
                  {audience.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StepMark({ index, done }: { index: number; done: boolean }) {
  return (
    <span className="v-join-step-mark" aria-label={done ? "Done" : undefined}>
      {done ? (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        String(index).padStart(2, "0")
      )}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M12.5 3.5 7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="m2.5 4.5 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
