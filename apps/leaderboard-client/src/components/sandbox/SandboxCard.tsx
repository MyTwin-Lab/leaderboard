"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { SandboxView } from "@/lib/public/sandbox";
import { useStarToggle, type StarState } from "./StarButton";
import { challengePath, sandboxPath } from "@/lib/paths";
import { coverShot } from "@/lib/coverImage";
import { VitrineAvatar } from "@/components/vitrine/VitrineAvatar";
import { ArrowTinyIcon } from "@/components/vitrine/SearchIcon";

interface SandboxCardProps {
  sandbox: SandboxView;
  /** L'utilisateur connecté, ou `null` — sert à reconnaître « ma » proposition. */
  currentUserId: string | null;
  /** Le rang dans le listing : il choisit l'illustration de repli. */
  index?: number;
  onStarState?: (sandboxId: string, state: StarState) => void;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return dateFmt.format(new Date(iso));
}

/**
 * La carte d'une proposition, d'après `Sandbox Redesign Vitrine.dc.html` :
 * la photo occupe le haut, l'étoile se pose dessus, et le pied porte l'auteur
 * et l'appel à l'action.
 */
export function SandboxCard({ sandbox, currentUserId, index = 0, onStarState }: SandboxCardProps) {
  const router = useRouter();

  const mine = currentUserId !== null && sandbox.user_id === currentUserId;
  const promoted = sandbox.status === "promoted";
  const shot = coverShot(sandbox.cover_image_url, index, "sandbox");

  // Un sandbox promu ou archivé n'accepte plus de star (409 côté service) ;
  // l'auteur, lui, n'a jamais pu starer le sien (403).
  const starDisabled = mine || sandbox.status !== "open";
  const starReason = mine
    ? "You can’t star your own sandbox"
    : "This sandbox is no longer open to stars";

  const { count, starred, pending, error, toggle } = useStarToggle({
    sandboxId: sandbox.uuid,
    starCount: sandbox.star_count,
    myStar: sandbox.my_star,
    disabled: starDisabled,
    onState: (state) => onStarState?.(sandbox.uuid, state),
  });

  // Le CTA d'un sandbox promu mène au challenge, pas à la proposition : c'est
  // là qu'il y a désormais quelque chose à faire. La carte, elle, continue
  // d'ouvrir le détail du sandbox.
  const detail = sandboxPath(sandbox.slug);
  const ctaHref =
    promoted && sandbox.promoted_challenge_id
      ? challengePath(sandbox.promoted_challenge_slug ?? sandbox.promoted_challenge_id)
      : detail;
  const ctaLabel = promoted ? "See the challenge" : mine ? "Open my sandbox" : "Read the proposal";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(detail)}
      onKeyDown={(event) => event.key === "Enter" && router.push(detail)}
      className="v-card"
      style={{ cursor: "pointer" }}
    >
      <div className="v-card-shot">
        {/* eslint-disable-next-line @next/next/no-img-element -- source libre : banque locale ou /api/images */}
        <img src={shot.src} alt="" className="v-card-img" style={{ objectPosition: shot.position }} />
        <div className="v-card-scrim" aria-hidden />

        <div className="v-card-top">
          <div className="v-card-top-left">
            {promoted && <span className="v-sb-promoted">Promoted</span>}
          </div>

          <div className="v-sb-star-wrap">
            <button
              type="button"
              className="v-sb-star"
              data-on={starred ? "true" : "false"}
              data-disabled={starDisabled ? "true" : "false"}
              disabled={starDisabled || pending}
              title={starDisabled ? starReason : undefined}
              aria-pressed={starred}
              aria-label={`${starred ? "Unstar" : "Star"} this sandbox`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void toggle();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill={starred ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {count}
            </button>
            {error && <span className="v-sb-star-error">{error}</span>}
          </div>
        </div>

        <div className="v-card-bottom">
          {/* Un vrai lien pour les moteurs, que ni un onClick ni un router.push
              ne remplacent. Le clic simple reste géré par la carte. */}
          <h3 className="v-card-title">
            <Link
              href={detail}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) event.stopPropagation();
                else event.preventDefault();
              }}
              tabIndex={-1}
            >
              {sandbox.title}
            </Link>
          </h3>
          {sandbox.context && <p className="v-card-desc">{sandbox.context}</p>}
        </div>
      </div>

      <div className="v-card-body">
        <div className="v-sb-foot">
          <div className="v-sb-author">
            <VitrineAvatar
              name={sandbox.author?.full_name ?? "Someone"}
              avatarUrl={sandbox.author?.avatar_url}
              size="1.875rem"
            />
            <span className="v-sb-author-text">
              <span className="v-sb-author-name">
                {mine ? "You" : sandbox.author?.full_name ?? "Someone"}
              </span>
              <span className="v-sb-author-date">{formatDate(sandbox.created_at)}</span>
            </span>
          </div>

          <Link
            href={ctaHref}
            className="v-card-cta"
            data-quiet={promoted ? "true" : "false"}
            onClick={(event) => event.stopPropagation()}
          >
            {ctaLabel}
            <ArrowTinyIcon />
          </Link>
        </div>
      </div>
    </div>
  );
}
