import type { Metadata } from "next";

import { BookingForm } from "@/components/booking/BookingForm";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { BOOKING_PATH, parseBookingIntent, type BookingIntent } from "@/lib/booking";
import { pageMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/booking/booking-vitrine.css";

// Une page de conversion, pas de contenu : elle n'a rien à faire dans un index,
// mais ses liens (le retour au Lab) peuvent être suivis.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Book a meeting",
    description: "Book a 30-minute one-to-one call with the MyTwin Lab team.",
    path: BOOKING_PATH,
  }),
  robots: { index: false, follow: true },
};

/** L'accroche suit l'appel qui a mené ici ; sans `?for=`, la page reste générale. */
const COPY: Record<BookingIntent | "general", { eyebrow: string; lede: string }> = {
  twin: {
    eyebrow: "Create your twin",
    lede: "A twin for yourself, your patients or your employees? Leave your details, then pick a time that suits you.",
  },
  project: {
    eyebrow: "Your project in the Sandbox",
    lede: "Got a health project in mind? Let's talk it through and see how to launch it in the Sandbox with the Lab community.",
  },
  general: {
    eyebrow: "MyTwin Lab",
    lede: "A one-to-one call to talk about your twin, your project or the Lab. Leave your details, then pick a time that suits you.",
  },
};

/**
 * `/book` — la prise de rendez-vous, au style vitrine.
 *
 * Deux temps : le prénom et l'e-mail ici, puis le créneau sur Calendly, où ils
 * arrivent pré-remplis (`lib/booking.ts`). Pas d'iframe : la page n'appelle
 * aucun tiers tant que le visiteur n'a pas cliqué, et le Lab reste sans
 * cookie non essentiel.
 */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const intent = parseBookingIntent((await searchParams).for);
  const copy = COPY[intent ?? "general"];

  return (
    <div className={`vitrine v-book ${vitrineFontVars}`}>
      <div className="v-main">
        <BackToLab />

        <div className="v-book-grid">
          <header className="v-book-intro">
            <span className="v-eyebrow">
              <span className="v-eyebrow-dot" aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <h1 className="v-title">Book a meeting with us</h1>
            <p className="v-lede">{copy.lede}</p>

            <ul className="v-book-facts">
              <li>
                <ClockIcon />
                30 minutes
              </li>
              <li>
                <PersonIcon />
                One-to-one with Rubens Valcy
              </li>
              <li>
                <VideoIcon />
                Google Meet, link sent on booking
              </li>
            </ul>
          </header>

          <BookingForm intent={intent} />
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.75V8l2.25 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.25" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 14c.6-2.6 2.7-4.25 5.25-4.25s4.65 1.65 5.25 4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.75" y="4" width="9" height="8" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.75 7 3.5-2v6l-3.5-2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
