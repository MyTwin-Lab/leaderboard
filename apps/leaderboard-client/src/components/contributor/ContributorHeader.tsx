import { GitHubIcon } from "@/components/ui/GitHubIcon";
import { VitrineAvatar } from "@/components/vitrine/VitrineAvatar";
import { formatCP } from "@/lib/formatters";
import type { ContributorRankGap } from "@/lib/types";

interface ContributorHeaderProps {
  displayName: string;
  githubUsername?: string;
  bio?: string;
  avatarUrl?: string;
  totalCP: number;
  globalRank?: number;
  rankGap?: ContributorRankGap;
  contributingSince?: string;
  avatarSlot?: React.ReactNode;
  /** La pastille « Admin », sur sa propre page quand on en est un. */
  isAdmin?: boolean;
}

function formatSince(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function rankGapLabel(gap: ContributorRankGap) {
  const cp = formatCP(gap.cp);
  return gap.direction === "ahead"
    ? `Leading by ${cp} CP over #${gap.rank}`
    : `${cp} CP behind #${gap.rank}`;
}

/**
 * La carte d'identité de la page d'un contributeur, d'après
 * `Profile Vitrine.dc.html`.
 *
 * Colonne de gauche sur écran, où elle reste au défilement pendant qu'on
 * parcourt les onglets ; en-tête pleine largeur sur téléphone, où la photo
 * passe à côté du nom (`profile-vitrine.css`).
 *
 * Le rang est une pastille sur la photo, sans médaille : la maquette donne la
 * même à tous les rangs, et l'or du podium est le langage du classement, pas
 * celui d'une fiche.
 */
export function ContributorHeader({
  displayName,
  githubUsername,
  bio,
  avatarUrl,
  totalCP,
  globalRank,
  rankGap,
  contributingSince,
  avatarSlot,
  isAdmin = false,
}: ContributorHeaderProps) {
  const metaLine = [bio, contributingSince ? `contributing since ${formatSince(contributingSince)}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside className="v-pro-side">
      <div className="v-pro-id">
        <div className="v-pro-shot">
          {avatarSlot ?? (
            <VitrineAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              size="clamp(4rem, 12vw, 4.5rem)"
              ring={false}
            />
          )}
          {globalRank != null && <span className="v-pro-rank">#{globalRank}</span>}
        </div>

        <div className="v-pro-ident">
          <span className="v-pro-kicker">Contributor profile</span>
          <h1 className="v-pro-name">{displayName}</h1>
          {metaLine && <p className="v-pro-meta">{metaLine}</p>}
        </div>

        {(githubUsername || isAdmin) && (
          <div className="v-pro-chips">
            {githubUsername && (
              <a
                href={`https://github.com/${githubUsername}`}
                target="_blank"
                // Identifiant saisi par le contributeur : `ugc`, pour ne pas
                // transmettre l'autorité du site.
                rel="ugc noopener noreferrer"
                className="v-pro-chip"
              >
                <GitHubIcon />
                {githubUsername}
              </a>
            )}
            {isAdmin && (
              <span className="v-pro-badge">
                <span className="v-pro-badge-dot" />
                Admin
              </span>
            )}
          </div>
        )}
      </div>

      <div className="v-pro-cp">
        <span className="v-pro-cp-line">
          <span className="v-pro-cp-value">{formatCP(totalCP)}</span>
          <span className="v-pro-cp-unit">CP</span>
        </span>
        {rankGap && <span className="v-pro-cp-gap">{rankGapLabel(rankGap)}</span>}
      </div>
    </aside>
  );
}
