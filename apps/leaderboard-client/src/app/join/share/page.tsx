import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ShareForm } from "@/components/join/ShareForm";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { JOIN_PATH, JOIN_SHARE_PATH, JOIN_WELCOME_PATH } from "@/lib/join";
import { readLabMember } from "@/lib/server/labMember";
import { pageMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/booking/booking-vitrine.css";
import "@/components/join/join-vitrine.css";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Share your health story",
    description: "Share a health experience with the MyTwin Lab.",
    path: JOIN_SHARE_PATH,
  }),
  robots: { index: false, follow: true },
};

/** Ce qu'on peut raconter : des pistes, pour ne pas laisser la page blanche. */
const PROMPTS = [
  "A doubt, or a difficult medical decision",
  "A complex care journey",
  "A moment you wish you had been better informed",
  "How a digital twin could have helped you",
];

/**
 * `/join/share` — l'anecdote de santé d'un membre du Lab.
 *
 * Réservée au membre reconnu par son cookie : c'est lui qui rattache
 * l'anecdote à sa fiche CRM, l'e-mail ne passe jamais par la page.
 */
export default async function JoinSharePage() {
  const member = await readLabMember();
  if (!member) redirect(JOIN_PATH);

  return (
    <div className={`vitrine v-book v-join ${vitrineFontVars}`}>
      <div className="v-main">
        <BackToLab href={JOIN_WELCOME_PATH} label="Back to your welcome page" />

        <div className="v-book-grid v-join-share-grid">
          <header className="v-book-intro">
            <span className="v-eyebrow">
              <span className="v-eyebrow-dot" aria-hidden="true" />
              Your first step
            </span>
            <h1 className="v-title">
              Share your <em className="v-join-em">health story</em>
            </h1>
            <p className="v-lede">
              To build a twin that truly matters, your experience is precious. Tell us about a moment that marked you,
              in your own words.
            </p>

            <ul className="v-book-facts">
              {PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <DotIcon />
                  {prompt}
                </li>
              ))}
            </ul>
          </header>

          <ShareForm />
        </div>
      </div>
    </div>
  );
}

function DotIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" fill="currentColor" />
    </svg>
  );
}
