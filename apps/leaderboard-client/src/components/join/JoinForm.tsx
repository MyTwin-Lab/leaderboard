"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { joinLab } from "@/app/join/actions";
import { JOIN_WELCOME_PATH, type LabRole } from "@/lib/join";

/** Les rôles proposés, dans l'ordre affiché. « Other » est le défaut implicite. */
const ROLE_OPTIONS: { value: LabRole; label: string }[] = [
  { value: "patient", label: "Patient or caregiver" },
  { value: "clinician", label: "Clinician" },
  { value: "researcher", label: "Researcher" },
  { value: "developer", label: "Developer" },
  { value: "other", label: "Other" },
];

/**
 * L'e-mail, et en option ce que la personne se déclare être.
 *
 * Le bouton s'active dès qu'il y a un e-mail ; le rôle ne le retient jamais.
 * Rien de coché part comme « Other ». Une pastille cochée se décoche d'un
 * second clic : sans ça, un choix fait par erreur ne pourrait plus revenir à
 * « rien ».
 */
export function JoinForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LabRole | null>(null);
  const [joining, setJoining] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (role) data.set("role", role);
    setInvalid(false);
    setJoining(true);
    const result = await joinLab(data);
    if ("returning" in result) {
      router.push(result.returning ? `${JOIN_WELCOME_PATH}?back=1` : JOIN_WELCOME_PATH);
    } else {
      setInvalid(true);
      setJoining(false);
    }
  };

  return (
    <form className="v-book-card v-join-card" onSubmit={onSubmit}>
      <div className="v-book-field">
        <label htmlFor="join-email">Email</label>
        <input
          id="join-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={200}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <fieldset className="v-join-roles">
        <legend>I am…</legend>
        <div className="v-join-role-list" role="radiogroup" aria-label="I am">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="v-join-role"
              role="radio"
              aria-checked={role === option.value}
              data-on={role === option.value}
              onClick={() => setRole(role === option.value ? null : option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Pot de miel : hors écran, hors tabulation, ignoré des lecteurs d'écran. */}
      <div className="v-book-trap" aria-hidden="true">
        <label htmlFor="join-website">Website</label>
        <input id="join-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {invalid && (
        <p className="v-book-error" role="alert">
          Please check your email.
        </p>
      )}

      <button
        type="submit"
        className="v-book-cta"
        disabled={joining || email.trim() === ""}
        aria-busy={joining}
      >
        {joining ? "Joining…" : "Join the Lab"}
        {!joining && (
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

      <p className="v-join-consent">
        By joining, you agree to receive news from the MyTwin Lab by email. You can unsubscribe at any time. See our{" "}
        <Link href="/privacy-policy">privacy policy</Link>.
      </p>
    </form>
  );
}
