'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatCP } from "@/lib/formatters";
import { challengePath } from "@/lib/paths";
import { coverShot } from "@/lib/coverImage";
import { isPlaceholderChallenge } from "@/lib/challengeBrief";
import { VitrineAvatar } from "@/components/vitrine/VitrineAvatar";
import { ArrowTinyIcon } from "@/components/vitrine/SearchIcon";
import type { TeamMember } from "@/lib/types";

interface ChallengeCardProps {
  /** Pour l'URL admin, qui reste sur l'UUID. */
  challengeId: string;
  /** Pour la page publique. */
  challengeSlug: string;
  challengeTitle: string;
  challengeType?: string;
  /** Drives the "Delivered and evaluated" vs "N contributions this week" copy. */
  challengeStatus?: string;
  projectName: string;
  description: string | null;
  rewardPool: number;
  completion: number; // 0-100
  /** L'image posée à la création ou à l'édition ; sinon, l'illustration de repli. */
  coverImageUrl?: string | null;
  isMember?: boolean;
  isAdmin?: boolean;
  teamMembers: TeamMember[];
  /** Contributions in the last 7 days — feeds the activity row. */
  recentContributions?: number;
  /** 7 daily contribution counts, oldest → newest. */
  spark?: number[];
  /** Le rang dans le listing : il choisit l'illustration de repli. */
  index?: number;
  onCardClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const TYPE_LABEL: Record<string, string> = {
  ml: "ML",
  validation: "Validation",
  code: "Code",
  none: "None",
};

/** Les barres d'activité de la maquette : la plus haute en plein, les autres en clair. */
function sparkBars(values: number[]) {
  const max = Math.max(...values, 1);
  return values.map((value) => ({
    height: `${Math.max(14, Math.round((value / max) * 100))}%`,
    color: value >= max && value > 0 ? "#0b7a64" : "rgb(11 122 100 / 0.25)",
  }));
}

/**
 * La carte d'un challenge, d'après `Challenges Redesign Vitrine.dc.html` :
 * une photo qui occupe le haut, le pool en surimpression, puis la ligne
 * d'activité, la progression, l'équipe et l'appel à l'action.
 */
export function ChallengeCard({
  challengeId,
  challengeSlug,
  challengeTitle,
  challengeType,
  challengeStatus,
  projectName,
  description,
  rewardPool,
  completion,
  coverImageUrl,
  isMember = false,
  isAdmin = false,
  teamMembers,
  recentContributions = 0,
  spark = [0, 0, 0, 0, 0, 0, 0],
  index = 0,
  onCardClick,
}: ChallengeCardProps) {
  const router = useRouter();

  const normalizedType = (challengeType ?? "code").toLowerCase();
  const isPlaceholder = isPlaceholderChallenge(normalizedType);
  const done = challengeStatus === "completed";
  const dest = isAdmin ? `/admin/challenges/${challengeId}` : challengePath(challengeSlug);
  const shot = coverShot(coverImageUrl, index, "challenge");

  // La barre se remplit après le montage, comme dans la maquette.
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setBarWidth(completion), 120 + index * 40);
    return () => clearTimeout(timer);
  }, [completion, index]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (onCardClick) onCardClick(event);
    else router.push(dest);
  };

  const visibleTeam = teamMembers.slice(0, 4);
  const moreCount = teamMembers.length > 4 ? teamMembers.length - 4 : 0;

  const activity = done
    ? "Delivered and evaluated · CP distributed"
    : teamMembers.length === 0
      ? "No contributor yet · be the first"
      : `${recentContributions} contribution${recentContributions === 1 ? "" : "s"} this week · ${teamMembers.length} active`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) =>
        event.key === "Enter" && handleClick(event as unknown as React.MouseEvent<HTMLDivElement>)
      }
      className="v-card"
      style={{ cursor: "pointer" }}
    >
      <div className="v-card-shot">
        {/* eslint-disable-next-line @next/next/no-img-element -- source libre : banque locale ou /api/images */}
        <img src={shot.src} alt="" className="v-card-img" style={{ objectPosition: shot.position }} />
        <div className="v-card-scrim" aria-hidden />

        <div className="v-card-top">
          <div className="v-card-top-left">
            <span className="v-card-tag">{TYPE_LABEL[normalizedType] ?? "Code"}</span>
            {isMember && <span className="v-card-tag">✓ Joined</span>}
            <span className="v-ch-project-name-on-shot">{projectName}</span>
          </div>
          <div className="v-ch-pool">
            <span className="v-ch-pool-value">{formatCP(rewardPool)}</span>
            <span className="v-ch-pool-label">CP POOL</span>
          </div>
        </div>

        <div className="v-card-bottom">
          {/* Un vrai lien pour les moteurs, qui ne suivent ni un onClick ni un
              router.push. Un clic simple reste géré par la carte (navigation ou
              menu admin) ; un clic modifié est laissé au navigateur. */}
          <h3 className="v-card-title">
            <Link
              href={dest}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) event.stopPropagation();
                else event.preventDefault();
              }}
              tabIndex={-1}
            >
              {challengeTitle}
            </Link>
          </h3>
          {description && <p className="v-card-desc">{description}</p>}
        </div>
      </div>

      <div className="v-card-body">
        <div className="v-ch-meta">
          <div className="v-ch-activity">
            <div className="v-ch-spark">
              {sparkBars(spark).map((bar, i) => (
                <span key={i} style={{ height: bar.height, background: bar.color }} />
              ))}
            </div>
            <span className="v-ch-activity-text">{activity}</span>
          </div>
          <div className="v-ch-progress">
            <div className="v-ch-bar" data-done={done ? "true" : "false"}>
              <span style={{ width: `${barWidth}%` }} />
            </div>
            <span className="v-ch-pct">{completion}%</span>
            <span className="v-ch-project-inline">{projectName}</span>
          </div>
        </div>

        <div className="v-ch-foot">
          <div className="v-ch-team">
            {visibleTeam.map((member) => (
              <VitrineAvatar
                key={member.id}
                name={member.fullName}
                avatarUrl={member.avatarUrl}
                size="1.875rem"
              />
            ))}
            {moreCount > 0 && <div className="v-ch-team-more">+{moreCount}</div>}
            {teamMembers.length === 0 && <span className="v-ch-team-solo">No one yet</span>}
          </div>
          {/* « Contribute » serait faux sur un repère : il n'y a rien à
              rejoindre ni à soumettre. La carte mène à sa page, et le dit. */}
          <span className="v-card-cta" data-quiet={done || isPlaceholder ? "true" : "false"}>
            {isPlaceholder ? "Read more" : done ? "See results" : "Contribute"}
            <ArrowTinyIcon />
          </span>
        </div>
      </div>
    </div>
  );
}
