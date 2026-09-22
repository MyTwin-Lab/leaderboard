"use client";

import Link from "next/link";

import { formatCP } from "@/lib/formatters";
import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";
import type { LeaderboardEntry } from "@/lib/types";
import { VitrineAvatar } from "@/components/vitrine/VitrineAvatar";
import { ArrowRightIcon } from "@/components/vitrine/SearchIcon";

/**
 * Le classement : une seule carte, la ligne du leader en tête sur fond vert,
 * puis les suivantes séparées d'un filet.
 *
 * Toutes les lignes ont la même hauteur, leader compris : c'est son fond, son
 * rang en vert et sa pastille « LEADER » qui le distinguent, pas sa taille.
 */
export function LeaderboardTable() {
  const { leader, rest, currentUserId, error, isLoading } = useLeaderboardContext();

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
        <VitrineAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} size="2.5rem" />
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
            <span className="v-lb-empty-title">No contributor matches</span>
            <span className="v-lb-empty-sub">Try another project or clear the search.</span>
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
