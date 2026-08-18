import Link from "next/link";

const ArrowIcon = () => (
  <svg className="h-4 w-4" style={{ color: "inherit" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
  </svg>
);

export function HomeHero() {
  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col justify-center gap-5 sm:gap-6">
      {/* Eyebrow */}
      <div className="flex items-center gap-3">
        <span className="h-[2px] w-8 rounded-full bg-brandCP" />
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-brandCP">
          #WeAreNotWaiting
        </span>
      </div>

      {/* H1 */}
      <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
        A global movement to reinvent health.{" "}
        <span className="text-brandCP">Together.</span>
      </h1>

      {/* Body */}
      <p className="max-w-lg text-sm leading-relaxed text-white/60 sm:text-base">
        Students, engineers, clinicians, researchers and citizens who refuse to wait for
        health innovation to happen to them. Every contribution is tracked, evaluated and
        rewarded in CP.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link
          href="/challenges"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brandCP px-6 py-3.5 text-sm font-semibold shadow-[0_10px_26px_rgba(10,247,193,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(10,247,193,0.35)]"
          style={{ color: "#ffffff" }}
        >
          Join a challenge
          <ArrowIcon />
        </Link>
        <Link
          href="#"
          className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.08]"
        >
          How CP works
        </Link>
      </div>

      {/* Quote */}
      <p className="mt-1 flex items-start gap-3 text-sm italic text-white/40">
        <span className="mt-[9px] h-[2px] w-5 shrink-0 rounded-full bg-brandCP/50" />
        If you contribute, you exist. If you build, you shine.
      </p>
    </div>
  );
}
