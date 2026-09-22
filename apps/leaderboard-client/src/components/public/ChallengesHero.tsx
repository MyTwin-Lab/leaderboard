interface ChallengesHeroStat {
  value: string;
  label: string;
}

interface ChallengesHeroProps {
  stats: ChallengesHeroStat[];
}

/**
 * L'en-tête de `Challenges Redesign Vitrine.dc.html` — et, depuis, celui des
 * trois pages : `vitrine.css` en porte les mesures.
 */
export function ChallengesHero({ stats }: ChallengesHeroProps) {
  return (
    <div className="v-head">
      <div className="v-head-text">
        {/* La pastille suit le texte ici, là où le Leaderboard et le Sandbox
            la posent devant — et elle bat à la couleur primaire du thème,
            pas à l'accent de la maquette. */}
        <p className="v-eyebrow">
          Open work
          <span className="v-eyebrow-dot" data-brand="true" />
        </p>
        <h1 className="v-title">Challenges</h1>
        <p className="v-lede">Pick a challenge, join the team, ship a contribution.</p>
      </div>

      <div className="v-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="v-stat">
            <span className="v-stat-value">{stat.value}</span>
            <span className="v-stat-label">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
