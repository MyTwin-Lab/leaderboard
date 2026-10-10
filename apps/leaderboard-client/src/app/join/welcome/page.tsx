import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { JOIN_PATH, JOIN_WELCOME_PATH } from "@/lib/join";
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

/** Qui fait quoi dans le Lab : des exemples, pas des boutons. */
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

  return (
    <div className={`vitrine v-join ${vitrineFontVars}`}>
      <div className="v-main">
        <BackToLab />

        <header className="v-join-hero">
          <h1 className="v-title v-join-hero-title">Welcome to the MyTwin Lab community</h1>
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

        <section className="v-join-section" aria-labelledby="join-audiences-title">
          <div className="v-join-section-head">
            <h2 id="join-audiences-title" className="v-join-section-title">
              Everyone has a place in the Lab
            </h2>
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

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="m2.5 4.5 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
