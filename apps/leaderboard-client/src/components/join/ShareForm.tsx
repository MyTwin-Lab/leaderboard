"use client";

import { startTransition, useActionState } from "react";

import { shareAnecdote, type ShareAnecdoteState } from "@/app/join/actions";
import { ANECDOTE_MAX_LENGTH } from "@/lib/join";

const ERRORS: Record<NonNullable<ShareAnecdoteState["error"]>, string> = {
  empty: "Please write your story before sending it.",
  consent: "Please accept the sharing conditions.",
  server: "Something went wrong on our side. Please try again in a moment.",
};

/**
 * L'anecdote et son consentement. Envoyée, la server action ramène le membre
 * sur `/join/welcome`, le pas coché ; seule une erreur reste ici.
 *
 * Soumis à la main plutôt que par `<form action>` : React vide un formulaire
 * après chaque action, et une erreur effacerait l'histoire qu'on vient
 * d'écrire.
 */
export function ShareForm() {
  const [state, action, pending] = useActionState(shareAnecdote, {});

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  return (
    <form className="v-book-card v-join-card" onSubmit={onSubmit}>
      <div className="v-book-field">
        <label htmlFor="share-content">Your story</label>
        <textarea
          id="share-content"
          name="content"
          className="v-join-textarea"
          required
          maxLength={ANECDOTE_MAX_LENGTH}
          readOnly={pending}
          aria-invalid={state.error === "empty" || undefined}
          placeholder="My mother had what seemed like a simple cold that lasted for weeks. She saw her doctor several times and was told it would pass. Three months later, she went to the emergency room: kidney disease. A blood test done earlier could have caught it in time…"
        />
      </div>

      <label className="v-join-check">
        <input name="consent" type="checkbox" disabled={pending} />
        <span>
          I understand that my story will be processed anonymously and used only to improve MyTwin services.
        </span>
      </label>

      {/* Pot de miel : hors écran, hors tabulation, ignoré des lecteurs d'écran. */}
      <div className="v-book-trap" aria-hidden="true">
        <label htmlFor="share-website">Website</label>
        <input id="share-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error && (
        <p className="v-book-error" role="alert">
          {ERRORS[state.error]}
        </p>
      )}

      <button type="submit" className="v-book-cta" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Share my story"}
      </button>

      <p className="v-join-consent">Your story stays anonymous. We never share your personal data.</p>
    </form>
  );
}
