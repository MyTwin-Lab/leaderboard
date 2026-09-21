import Image from "next/image";

import { formatCP } from "@/lib/formatters";

// Instantané du classement de `/leaderboard`, écrit à la main pour montrer les
// photos de la landing (`public/landing/contributors/`), que les comptes n'ont
// pas. À rebrancher sur `fetchLeaderboard()` quand les avatars suivront.
const TOP_CONTRIBUTORS = [
  { rank: 1, name: "Alix Chagot", bio: "Software Engineer", cp: 23641, photo: "alix_chagot.webp" },
  { rank: 2, name: "Antoine", bio: "Software Engineer", cp: 7600, photo: "antoine_tessier.webp" },
  { rank: 3, name: "Mahdi Lamriben", bio: "Fullstack, Data & AI Engineer", cp: 6000, photo: "mahdi_lamriben.webp" },
] as const;

export function LandingTopContributors() {
  return (
    <div className="l-podium">
      <div className="l-podium__head">
        <p className="l-eyebrow l-eyebrow--live">Live ranking</p>
        <h4 className="l-heading l-podium__title">Top 3 contributors</h4>
      </div>
      <ol className="l-podium__list">
        {TOP_CONTRIBUTORS.map((contributor) => (
          <li key={contributor.name} className="l-podium__row" data-first={contributor.rank === 1}>
            <span className="l-podium__rank">{contributor.rank}</span>
            <Image
              className="l-podium__avatar"
              src={`/landing/contributors/${contributor.photo}`}
              alt=""
              width={80}
              height={80}
            />
            <span className="l-podium__who">
              <span className="l-podium__name">{contributor.name}</span>
              <span className="l-podium__bio">{contributor.bio}</span>
            </span>
            <span className="l-podium__cp">
              {formatCP(contributor.cp)}
              <small>CP</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
