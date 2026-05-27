"use client";

import { useState } from "react";
import type { DiscordEvaluationEntry } from "@/lib/server/leaderboard";

interface DiscordSectionProps {
  evaluations: DiscordEvaluationEntry[];
  isOwner: boolean;
  discordAccount: { discord_id: string; username: string } | null;
}

export function DiscordSection({ evaluations, isOwner, discordAccount }: DiscordSectionProps) {
  if (isOwner && !discordAccount) {
    return <DiscordLinkForm />;
  }

  if (evaluations.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md bg-white/5 p-4 text-sm text-white/60 sm:p-6 sm:text-base">
        Aucune aide Discord pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {evaluations.map((ev) => (
        <div
          key={ev.uuid}
          className="rounded-md bg-white/5 px-4 py-3 shadow-md shadow-black/20 sm:px-5 sm:py-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{ev.emoji}</span>
              <span className="text-sm font-semibold text-white sm:text-base">
                Aide Discord
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ev.status === "evaluated" && ev.score !== null && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white sm:px-3 sm:py-1 sm:text-sm">
                  {ev.score} <span className="text-brandCP">pts</span>
                </span>
              )}
              <StatusBadge status={ev.status} />
            </div>
          </div>

          {ev.justification && (
            <p className="mt-2 text-xs text-white/60 sm:text-sm">{ev.justification}</p>
          )}

          {ev.evaluatedAt && (
            <p className="mt-2 text-[10px] text-white/40 sm:text-xs">
              {new Date(ev.evaluatedAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function DiscordLinkForm() {
  const [discordId, setDiscordId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/discord/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_id: discordId.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Une erreur est survenue.");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setError("Une erreur est survenue.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-400 sm:p-6">
        Compte Discord lié avec succès. Rechargez la page pour voir vos évaluations.
      </div>
    );
  }

  return (
    <div className="rounded-md bg-white/5 p-4 sm:p-6">
      <p className="mb-4 text-sm text-white/70">
        Liez votre compte Discord pour que vos points d'entraide apparaissent ici.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          placeholder="Votre Discord ID (ex: 123456789012345678)"
          className="flex-1 rounded-md bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-brandCP"
          required
        />
        <button
          type="submit"
          disabled={status === "loading" || !discordId.trim()}
          className="rounded-md bg-brandCP/20 px-4 py-2 text-sm font-medium text-brandCP transition hover:bg-brandCP/30 disabled:opacity-50"
        >
          {status === "loading" ? "Liaison…" : "Lier"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-3 text-[11px] text-white/30">
        Ton Discord ID se trouve dans Paramètres → Avancés → Mode développeur, puis clic droit sur ton profil → Copier l'identifiant.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    evaluated: "bg-green-500/20 text-green-400",
    skipped: "bg-yellow-500/20 text-yellow-400",
    pending: "bg-white/10 text-white/50",
    running: "bg-blue-500/20 text-blue-400",
  };

  const labels: Record<string, string> = {
    evaluated: "Évalué",
    skipped: "Ignoré",
    pending: "En attente",
    running: "En cours",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs ${styles[status] ?? "bg-white/10 text-white/50"}`}>
      {labels[status] ?? status}
    </span>
  );
}