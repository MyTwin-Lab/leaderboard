"use client";

import type { DiscordEvaluationEntry } from "@/lib/server/leaderboard";

interface DiscordSectionProps {
  evaluations: DiscordEvaluationEntry[];
}

export function DiscordSection({ evaluations }: DiscordSectionProps) {
  if (evaluations.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md bg-white/5 p-4 text-sm text-white/60 sm:p-6 sm:text-base">
        No Discord help yet.
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