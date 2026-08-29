import Link from "next/link";

/** Bottom banner nudging non-ranked visitors toward a challenge — rendered
 * alongside the "Other contributors" list (see LeaderboardProvider.showList). */
export function LeaderboardCTA() {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-brandCP/15 bg-brandCP/[0.06] px-5 py-6 sm:px-7">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[17px] font-semibold tracking-tight text-white">
          Not on the board yet?
        </span>
        <span className="text-sm leading-relaxed text-white/55">
          Join an open challenge — your first evaluated contribution puts you on it.
        </span>
      </div>
      <Link
        href="/challenges"
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brandCP px-5 py-3 text-[13px] font-semibold transition-transform duration-200 hover:-translate-y-0.5"
        style={{ color: "#ffffff" }}
      >
        Browse challenges
        <span>&rarr;</span>
      </Link>
    </div>
  );
}
