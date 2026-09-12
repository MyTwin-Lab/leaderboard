import Link from "next/link";

/** Bandeau de bas de page des challenges, jumeau de `LeaderboardCTA` : celui-ci
 * pousse vers `/challenges` qui n'a pas trouvé sa place au classement, celui-là
 * vers `/sandbox` qui n'a pas trouvé le challenge qu'il cherchait. */
export function SandboxCTA() {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-brandCP/15 bg-brandCP/[0.06] px-5 py-6 sm:px-7">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[17px] font-semibold tracking-tight text-white">
          Nothing here matches what you want to build?
        </span>
        <span className="text-sm leading-relaxed text-white/55">
          Propose it in the Sandbox - no approval needed, and the community stars what it wants
          built.
        </span>
      </div>
      <Link
        href="/sandbox"
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brandCP px-5 py-3 text-[13px] font-semibold transition-transform duration-200 hover:-translate-y-0.5"
        style={{ color: "#ffffff" }}
      >
        Open the Sandbox
        <span>&rarr;</span>
      </Link>
    </div>
  );
}
