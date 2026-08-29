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
      <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
        <span className="text-brandCP">Together,</span> we’re building the world’s most
        advanced digital twin of the human body.
      </h1>

      {/* Body */}
      <p className="max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
        Students, engineers, clinicians, researchers and citizens contributing to a shared
        mission: creating the most advanced digital twin of the human body and making the
        best health innovations accessible to everyone. Every contribution is tracked,
        evaluated and rewarded in CP.
      </p>
    </div>
  );
}
