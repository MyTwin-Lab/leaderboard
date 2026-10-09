import type { Metadata } from "next";
import Link from "next/link";

import { JoinForm } from "@/components/join/JoinForm";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { JOIN_PATH, JOIN_WELCOME_PATH } from "@/lib/join";
import { readLabMember } from "@/lib/server/labMember";
import { pageMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/booking/booking-vitrine.css";
import "@/components/join/join-vitrine.css";

// Une page de conversion, comme `/book` : hors de l'index, liens suivis.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Join the Lab",
    description: "Join the MyTwin Lab community and follow how the human digital twin is built.",
    path: JOIN_PATH,
  }),
  robots: { index: false, follow: true },
};

/** Ce que la liste de diffusion apporte — la promesse que le consentement couvre. */
const NEWS = [
  "New challenges, as soon as they open",
  "Research progress on the human digital twin",
  "What the community builds, and how to take part",
];

/**
 * `/join` — « Join the Lab », au style vitrine, sur la grille de `/book`.
 *
 * Un e-mail suffit ; le compte n'est demandé qu'au moment de participer à un
 * challenge. Un membre déjà reconnu par ce navigateur garde un raccourci vers
 * sa page, sans être redirigé : il peut vouloir inscrire une autre adresse.
 */
export default async function JoinPage() {
  const member = await readLabMember();

  return (
    <div className={`vitrine v-book v-join ${vitrineFontVars}`}>
      <div className="v-main">
        <BackToLab />

        <div className="v-book-grid">
          <header className="v-book-intro">
            <span className="v-eyebrow">
              <span className="v-eyebrow-dot" aria-hidden="true" />
              MyTwin Lab community
            </span>
            <h1 className="v-title">
              Join the <em className="v-join-em">Lab</em>
            </h1>
            <p className="v-lede">
              Patients, clinicians, researchers and developers, building the world&rsquo;s most advanced human digital
              twin together. Leave your email to follow the mission as it moves forward.
            </p>

            <ul className="v-book-facts">
              {NEWS.map((item) => (
                <li key={item}>
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>

            {member && (
              <p className="v-join-known">
                Already a member? <Link href={JOIN_WELCOME_PATH}>Go to your welcome page</Link>
              </p>
            )}
          </header>

          <JoinForm />
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
