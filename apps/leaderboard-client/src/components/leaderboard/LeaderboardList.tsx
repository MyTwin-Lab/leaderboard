"use client";

import Link from "next/link";

import { formatCP } from "@/lib/formatters";
import type { LeaderboardEntry } from "@/lib/types";
import { VitrineAvatar } from "@/components/vitrine/VitrineAvatar";
import { ArrowRightIcon } from "@/components/vitrine/SearchIcon";

import "@/components/vitrine/vitrine.css";
import "./leaderboard-vitrine.css";

/**
 * Le classement, rendu à partir de ses seules données.
 *
 * Séparé de `LeaderboardTable`, qui lit le contexte : ce dernier lève une
 * erreur hors de `LeaderboardProvider`, et l'accueil du Lab n'en a pas — il
 * n'affiche qu'un podium déjà calculé côté serveur, sans filtre ni recherche à
 * porter. Une page qui a le contexte passe par `LeaderboardTable`, une autre
 * appelle ceci directement.
 *
 * Les deux feuilles sont importées ici plutôt que dans la page : elles sont ce
 * qui fait tenir le composant, et un appelant ne devrait pas avoir à le
 * savoir. Hors d'une vitrine, il reste à poser `.vitrine-embed` sur un parent
 * pour lui donner les jetons `--v-*`.
 */
export interface LeaderboardListProps {
  /** La ligne mise en avant, sur fond vert. `null` masque la distinction. */
  leader: LeaderboardEntry | null;
  /** Les rangs suivants. */
  rest: LeaderboardEntry[];
  currentUserId?: string;
  error?: string | null;
  isLoading?: boolean;
  /** Ce que dit la carte quand il n'y a rien à classer. */
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function LeaderboardList({
  leader,
  rest,
  currentUserId,
  error = null,
  isLoading = false,
  emptyTitle = "No contributor matches",
  emptySubtitle = "Try another project or clear the search.",
}: LeaderboardListProps) {
  if (error) {
    return <div className="v-lb-error">{error}</div>;
  }

  const isEmpty = !leader && rest.length === 0;

  const row = (entry: LeaderboardEntry, isLeader: boolean) => (
    <li key={entry.userId} className="v-lb-item">
      <Link
        href={`/contributors/${entry.userId}`}
        className="v-lb-row"
        data-leader={isLeader ? "true" : "false"}
        data-me={entry.userId === currentUserId ? "true" : "false"}
      >
        <span className="v-lb-row-rank">{entry.rank}</span>
        <VitrineAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} size="2.5rem" fallback="pastel" />
        <span className="v-lb-row-text">
          <span className="v-lb-row-line">
            <span className="v-lb-row-name">{entry.displayName}</span>
            {isLeader && <span className="v-lb-kicker">Leader</span>}
            {entry.userId === currentUserId && <span className="v-lb-you">YOU</span>}
          </span>
          {entry.bio && <span className="v-lb-row-bio">{entry.bio}</span>}
        </span>
        <span className="v-lb-row-cp">
          <span className="v-lb-row-cp-value">{formatCP(entry.totalCP)}</span>
          <span className="v-lb-row-cp-unit">CP</span>
        </span>
        <ArrowRightIcon className="v-lb-row-arrow" />
      </Link>
    </li>
  );

  return (
    <section className="v-lb-section">
      <ol className="v-lb-list">
        {leader && row(leader, true)}
        {rest.map((entry) => row(entry, false))}

        {isEmpty && (
          <li className="v-lb-empty">
            <span className="v-lb-empty-title">{emptyTitle}</span>
            <span className="v-lb-empty-sub">{emptySubtitle}</span>
          </li>
        )}

        {isLoading && (
          <li className="v-lb-loading">
            <span className="v-lb-loading-dot" />
            Updating…
          </li>
        )}
      </ol>
    </section>
  );
}
