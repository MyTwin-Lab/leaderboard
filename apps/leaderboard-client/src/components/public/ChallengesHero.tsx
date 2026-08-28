interface ChallengesHeroStat {
  value: string;
  label: string;
}

interface ChallengesHeroProps {
  stats: ChallengesHeroStat[];
}

/** Challenges page header — same eyebrow/H1 language as HomeHero, plus a
 * row of at-a-glance stat chips (open challenges, CP in play, projects). */
export function ChallengesHero({ stats }: ChallengesHeroProps) {
  return (
    <div className="animate-fade-up flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="h-[2px] w-7 rounded-full bg-brandCP" />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-brandCP">
            Open work
          </span>
        </div>
        <h1 className="text-4xl font-bold leading-[1.06] tracking-tight text-white sm:text-5xl">
          Challenges
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
          Pick a challenge, join the team, ship a contribution. The agent evaluates the work
          and distributes the CP pool.
        </p>
      </div>

      <div className="hidden flex-wrap gap-2.5 sm:flex">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex min-w-[104px] flex-col gap-0.5 px-4 py-3"
          >
            <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {stat.value}
            </span>
            <span className="text-[11px] text-white/45">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
