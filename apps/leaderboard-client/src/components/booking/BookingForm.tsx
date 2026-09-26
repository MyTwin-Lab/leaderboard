"use client";

import { useEffect, useState } from "react";

import { calendlyBookingUrl, type BookingIntent } from "@/lib/booking";

/**
 * Le prénom et l'e-mail, puis Calendly.
 *
 * Rien n'est envoyé au Lab : la soumission ouvre la page Calendly dans le même
 * onglet, les deux champs pré-remplis. La validation est celle du navigateur
 * (`required`, `type="email"`), à la hauteur de l'enjeu — Calendly revérifie.
 */
export function BookingForm({ intent }: { intent: BookingIntent | null }) {
  const [leaving, setLeaving] = useState(false);

  // Revenu par « Précédent », la page sort du cache du navigateur telle qu'on
  // l'a quittée : le bouton ne doit pas rester sur « Opening Calendly… ».
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLeaving(true);
    window.location.assign(
      calendlyBookingUrl({
        firstName: String(data.get("firstName") ?? ""),
        email: String(data.get("email") ?? ""),
        intent,
      }),
    );
  };

  return (
    <form className="v-book-card" onSubmit={onSubmit}>
      <div className="v-book-field">
        <label htmlFor="book-first-name">First name</label>
        <input
          id="book-first-name"
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          maxLength={100}
          placeholder="Your first name"
        />
      </div>

      <div className="v-book-field">
        <label htmlFor="book-email">Email</label>
        <input
          id="book-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={200}
          placeholder="you@example.com"
        />
      </div>

      <button type="submit" className="v-book-cta" disabled={leaving}>
        {leaving ? "Opening Calendly…" : "Choose a time"}
        {!leaving && (
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8h10m0 0-4-4m4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <p className="v-book-note">
        Next, you&rsquo;ll pick a slot on Calendly, with your details already filled in. They are only used to
        arrange this call.
      </p>
    </form>
  );
}
