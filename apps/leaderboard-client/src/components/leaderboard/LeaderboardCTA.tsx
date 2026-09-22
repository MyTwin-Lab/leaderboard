import Link from "next/link";

/**
 * Le bandeau nuit de bas de page — le même que celui de Challenges et de
 * Sandbox : mêmes mesures, mêmes polices, pas de flèche dans le bouton.
 */
export function LeaderboardCTA() {
  return (
    <section className="v-strip">
      <div className="v-strip-text">
        <span className="v-strip-title">Not on the board yet?</span>
        <span className="v-strip-sub">
          Join an open challenge — your first evaluated contribution puts you on it.
        </span>
      </div>
      <Link href="/challenges" className="v-strip-cta">
        Browse challenges
      </Link>
    </section>
  );
}
