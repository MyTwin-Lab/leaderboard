import Image from "next/image";

import { TOP_CONTRIBUTORS_SNAPSHOT } from "@/content/top-contributors";
import { formatCP } from "@/lib/formatters";

export function LandingTopContributors() {
  return (
    <div className="l-podium">
      <div className="l-podium__head">
        <p className="l-eyebrow l-eyebrow--live">Live ranking</p>
        <h4 className="l-heading l-podium__title">Top 3 contributors</h4>
      </div>
      <ol className="l-podium__list">
        {TOP_CONTRIBUTORS_SNAPSHOT.map((contributor) => (
          <li key={contributor.name} className="l-podium__row" data-first={contributor.rank === 1}>
            <span className="l-podium__rank">{contributor.rank}</span>
            <Image className="l-podium__avatar" src={contributor.photo} alt="" width={80} height={80} />
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
