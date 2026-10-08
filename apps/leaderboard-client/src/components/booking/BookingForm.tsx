"use client";

import { useEffect, useState } from "react";

import { startBooking } from "@/app/book/actions";
import type { BookingIntent } from "@/lib/booking";

/**
 * Le prénom et l'e-mail, puis Lemcal.
 *
 * La server action dépose la demande au CRM et rend l'URL Lemcal, que le
 * formulaire ouvre dans le même onglet, les deux champs pré-remplis. La
 * validation du navigateur (`required`, `type="email"`) arrête presque tout ;
 * le serveur revérifie, et seul son refus affiche un message.
 */
export function BookingForm({ intent }: { intent: BookingIntent | null }) {
  const [leaving, setLeaving] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // Revenu par « Précédent », la page sort du cache du navigateur telle qu'on
  // l'a quittée : le bouton ne doit pas rester sur « Opening the calendar… ».
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setInvalid(false);
    setLeaving(true);
    const result = await startBooking(intent, data);
    if ("url" in result) {
      window.location.assign(result.url);
    } else {
      setInvalid(true);
      setLeaving(false);
    }
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

      {/* Pot de miel : hors écran, hors tabulation, ignoré des lecteurs d'écran. */}
      <div className="v-book-trap" aria-hidden="true">
        <label htmlFor="book-website">Website</label>
        <input id="book-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {invalid && (
        <p className="v-book-error" role="alert">
          Please check your first name and email.
        </p>
      )}

      <button type="submit" className="v-book-cta" disabled={leaving}>
        {leaving ? "Opening the calendar…" : "Choose a time"}
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
    </form>
  );
}
