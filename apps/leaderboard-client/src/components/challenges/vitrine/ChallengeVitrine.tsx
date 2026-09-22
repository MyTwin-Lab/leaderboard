'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

import { Markdown } from '@/components/ui/Markdown';
import { VitrineAvatar } from '@/components/vitrine/VitrineAvatar';
import { vitrineFontVars } from '@/components/vitrine/fonts';
import { coverShot } from '@/lib/coverImage';
import { formatCP } from '@/lib/formatters';
import { leadAndBody, splitBriefContext, stripInlineMarkdown } from '@/lib/briefSections';
import type { GroupInvite } from '@/lib/challengeBrief';
import type { TeamMember } from '@/lib/types';
import { useVitrineChrome } from './useVitrineChrome';

import '@/components/vitrine/vitrine.css';
import './challenge-vitrine.css';

/**
 * La page d'un challenge telle que la voit un contributeur qui ne l'a pas
 * rejoint — d'après `Challenge Vitrine.dc.html`.
 *
 * Elle remplace l'écran précédent (le brief, sous une ligne de mesures) par la
 * page de la maquette : un hero photo, le problème que le challenge adresse,
 * qui le porte, puis le brief en colonne de lecture avec le pool, les
 * contributeurs et le bouton à droite. Les trois KPI de l'espace de travail
 * n'y figurent pas : ils parlent d'un board, d'une branche et d'une soumission
 * que le visiteur n'a pas encore.
 *
 * Deux mises en page, comme la maquette : l'écran et le téléphone. Elles se
 * distinguent en CSS (768px) sauf sur un point, qui n'est pas du style : sur
 * téléphone, **rejoindre ne mène nulle part** — l'espace de travail demande un
 * clavier et un IDE. Le visiteur reste donc sur cette page, et `isMember` y
 * remplace le bouton par le renvoi vers un ordinateur.
 */

export interface VitrineChallenge {
  uuid: string;
  title: string;
  description?: string | null;
  status: string;
  type: string;
  contribution_points_reward: number;
  cover_image_url?: string | null;
  host?: string | null;
}

interface ChallengeVitrineProps {
  challenge: VitrineChallenge;
  /** Le `brief.md` du challenge. Sa section « Context » monte en tête de page. */
  brief: string | null;
  /** Les contributeurs déjà là — leurs photos, dans la colonne de droite. */
  team: TeamMember[];
  participantCount: number;
  /** CP déjà distribués, pour la barre du pool. */
  awardedTotal: number;
  /** Le visiteur a rejoint : sur téléphone, cet écran reste le sien. */
  isMember: boolean;
  isAnonymous: boolean;
  /** `/signin?from=…` — un anonyme ne déclenche jamais un join depuis ici. */
  signInHref: string;
  /** Le challenge accepte-t-il encore quelqu'un ? */
  canJoin: boolean;
  onJoin: () => void;
  /** Non nul quand l'URL porte un `?group=` valide. */
  invite?: GroupInvite | null;
  onAcceptInvite: () => void;
  joining: boolean;
  joinError?: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  completed: 'Closed',
  draft: 'Draft',
  archived: 'Archived',
};

const TYPE_LABELS: Record<string, string> = {
  ml: 'ML',
  validation: 'Validation',
  code: 'Code',
};

const INVITE_BLOCKERS: Record<string, string> = {
  challenge_closed: 'This challenge is closed.',
  already_member: "You're already in this group.",
  already_solo: 'You already joined this challenge on your own, so you cannot switch to a group.',
  group_full: 'This group is full.',
};

/**
 * La roue d'illustrations de repli est indexée sur la position dans un
 * listing ; une page de détail n'en a pas. L'UUID en tient lieu : stable d'une
 * visite à l'autre, et la même photo que dans la liste n'est pas recherchée —
 * seule une couverture posée par un admin garantit les deux.
 */
function shotIndex(uuid: string): number {
  let sum = 0;
  for (let i = 0; i < uuid.length; i++) sum += uuid.charCodeAt(i);
  return sum;
}

function UserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function ChallengeVitrine({
  challenge, brief, team, participantCount, awardedTotal,
  isMember, isAnonymous, signInHref, canJoin, onJoin,
  invite, onAcceptInvite, joining, joinError,
}: ChallengeVitrineProps) {
  useVitrineChrome(true);

  const rootRef = useRef<HTMLDivElement>(null);

  // Le réarmement de la maquette : une mesure du rectangle au défilement, et
  // non un IntersectionObserver — le composant est rendu dans un conteneur
  // qui défile normalement, et cette version-là ne dépend d'aucun réglage de
  // racine. Le filet de sécurité de la maquette est gardé : quoi qu'il
  // arrive, plus rien ne reste caché au bout de 2,5 s.
  //
  // `data-reveal-ready`, posé ici et non dans le JSX, est ce qui arme les
  // règles de masquage : le HTML servi (celui que lisent les moteurs) montre
  // tout, et l'animation ne commence qu'une fois le script en place.
  useEffect(() => {
    const root = rootRef.current;
    if (root) root.dataset.revealReady = '1';
    const reveal = () => {
      const height = window.innerHeight || 800;
      document.querySelectorAll<HTMLElement>('.v-cd [data-reveal]').forEach((el) => {
        if (el.dataset.revealed) return;
        if (el.getBoundingClientRect().top < height * 0.92) el.dataset.revealed = '1';
      });
    };
    window.addEventListener('scroll', reveal, { passive: true });
    window.addEventListener('resize', reveal);
    reveal();
    const safety = setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.v-cd [data-reveal]').forEach((el) => {
        el.dataset.revealed = '1';
      });
    }, 2500);
    return () => {
      clearTimeout(safety);
      window.removeEventListener('scroll', reveal);
      window.removeEventListener('resize', reveal);
    };
  }, []);

  /**
   * « Read the brief » descend, il ne saute pas.
   *
   * Un `scroll-behavior: smooth` aurait fait la même chose, mais il se pose sur
   * l'élément qui défile — `html`, partagé avec tout le reste de l'app. Ici le
   * mouvement appartient à ce bouton. `scrollIntoView` ignore
   * `prefers-reduced-motion`, d'où la vérification explicite : le saut reste la
   * bonne réponse pour qui demande moins d'animation.
   */
  const scrollToBrief = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById('brief');
    if (!target) return;
    event.preventDefault();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    // L'ancre reste dans l'URL : un rechargement ou un partage rouvre la page
    // au même endroit, comme le ferait le lien seul.
    history.replaceState(null, '', '#brief');
  };

  const status = challenge.status;
  const statusLabel = STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  const isOpen = status !== 'completed' && status !== 'archived';
  const typeLabel = TYPE_LABELS[challenge.type] ?? 'Code';

  const shot = coverShot(challenge.cover_image_url, shotIndex(challenge.uuid), 'challenge');

  const pool = challenge.contribution_points_reward ?? 0;
  const poolProgress = pool > 0 ? Math.min(100, Math.round((awardedTotal / pool) * 100)) : 0;

  // La maquette pose une ligne de mesures sous le hero ; elle n'est pas rendue.
  // Le pool et les contributeurs vivent dans la colonne de droite du brief, et
  // les répéter sur la photo revenait à donner deux fois le même chiffre.

  // Le brief, coupé là où la maquette le coupe : sa section « Context » est ce
  // que la page appelle « Why this challenge exists ».
  const { why, rest } = splitBriefContext(brief);
  const { lead: whyLead, body: whyBody } = why ? leadAndBody(why) : { lead: '', body: [] };
  const whyBodyText = whyBody.join('\n\n');

  const faces = team.slice(0, 5);
  const overflow = Math.max(0, participantCount - 4);

  const joinLabel = invite ? `Join ${invite.ownerName}'s group` : 'Join the challenge';
  const inviteBlocked = !!invite && !invite.joinable;

  /** Le bouton, partout où la maquette en pose un. Un anonyme part se connecter. */
  const joinControl = (className: string) => {
    if (isAnonymous) {
      return (
        <a href={signInHref} className={className}>
          <UserPlusIcon />
          {joinLabel}
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={invite ? onAcceptInvite : onJoin}
        className={className}
        data-busy={joining || inviteBlocked ? 'true' : undefined}
      >
        <UserPlusIcon />
        {joining ? 'Joining…' : joinLabel}
      </button>
    );
  };

  /**
   * La seule légende sous le bouton : l'état de l'invitation, quand le
   * visiteur arrive par un lien de groupe. Hors de ce cas il n'y en a pas — ce
   * que rejoindre implique, la modale le dit au moment où la décision se
   * prend, et le répéter ici ne faisait qu'alourdir la fin du brief.
   */
  const inviteCaption = !invite
    ? null
    : invite.joinable
      ? `${invite.size} of ${invite.maxSize} members · you share their board, branch and contribution.`
      : INVITE_BLOCKERS[invite.reason ?? ''] ?? 'This invite is no longer valid.';

  // Un membre n'est ici que sur téléphone : le bouton n'a plus rien à faire,
  // et la page dit où le travail se poursuit.
  const desktopNotice = (
    <div className="v-cd-desk">
      <span className="v-cd-desk-title">
        <MonitorIcon />
        You&apos;re in — continue on a computer
      </span>
      <span className="v-cd-desk-body">
        Your board and your branch are ready. The workspace needs an editor and a terminal,
        so open this challenge on a computer to pick up the tasks.
      </span>
    </div>
  );

  return (
    <div ref={rootRef} className={`vitrine v-cd ${vitrineFontVars}`}>
      {/* ── L'en-tête de la maquette téléphone : retour, et le pool ── */}
      <div className="v-cd-mobile-bar">
        <Link href="/challenges" className="v-cd-back">
          <ArrowLeftIcon />
          Challenges
        </Link>
        {pool > 0 && (
          <span className="v-cd-mobile-pool">
            <b>{formatCP(pool)}</b>
            <span>CP pool</span>
          </span>
        )}
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="v-cd-hero">
        <div className="v-cd-hero-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- source libre (/api/images ou la banque de la landing) */}
          <img
            src={shot.src}
            alt=""
            aria-hidden="true"
            className="v-cd-hero-img"
            style={{ objectPosition: shot.position }}
          />
          <div aria-hidden="true" className="v-cd-hero-scrim" />

          <div className="v-cd-hero-body">
            <div className="v-cd-badges">
              <span className="v-cd-status" data-status={status} data-live={isOpen ? 'true' : undefined}>
                <span className="v-cd-status-dot" />
                {statusLabel}
              </span>
              <span className="v-cd-kind">{typeLabel}</span>
            </div>

            {/* Tout le reste tient en bas de la photo ; les pastilles, elles,
                restent en haut — d'où ce groupe, qui donne au `space-between`
                du hero ses deux extrémités. */}
            <div className="v-cd-hero-foot">
            <h1 className="v-cd-hero-title">{challenge.title}</h1>

            {challenge.description && <p className="v-cd-hero-lede">{challenge.description}</p>}

            {(!isMember && canJoin) || rest ? (
              <div className="v-cd-actions">
                {!isMember && canJoin && joinControl('v-cd-cta')}
                {rest && (
                  <a href="#brief" onClick={scrollToBrief} className="v-cd-cta-ghost">
                    Read the brief
                  </a>
                )}
              </div>
            ) : null}

            {/* Sur téléphone, les contributeurs remplacent les mesures. */}
            {participantCount > 0 && (
              <div className="v-cd-hero-people">
                <div className="v-cd-faces">
                  {team.slice(0, 4).map(member => (
                    <VitrineAvatar key={member.id} name={member.fullName} avatarUrl={member.avatarUrl} size="1.875rem" />
                  ))}
                  {overflow > 0 && <span className="v-cd-more">+{overflow}</span>}
                </div>
                <span className="v-cd-hero-people-text">
                  {participantCount} participant{participantCount > 1 ? 's' : ''} · own branch each
                </span>
              </div>
            )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Rejoint depuis un téléphone : on ne va pas plus loin ici ───── */}
      {isMember && <section className="v-cd-notice">{desktopNotice}</section>}

      {/* ── Why this challenge exists ──────────────────────────────────── */}
      {whyLead && (
        <section className="v-cd-why">
          <div className="v-cd-why-inner" data-reveal="true">
            <p className="v-cd-eyebrow">Why this challenge exists</p>
            <h2 className="v-cd-why-lead">{stripInlineMarkdown(whyLead)}</h2>
            {whyBodyText && (
              <div className="v-cd-md v-cd-why-body">
                <Markdown source={whyBodyText} variant="vitrine" headingOffset={2} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Who hosts this challenge ───────────────────────────────────── */}
      {challenge.host && (
        <section className="v-cd-host">
          <div className="v-cd-host-card" data-reveal="true">
            <div className="v-cd-host-text">
              <p className="v-cd-host-label">Who hosts this challenge</p>
              <h3 className="v-cd-host-name">{challenge.host}</h3>
            </div>
          </div>
        </section>
      )}

      {/* ── The brief ──────────────────────────────────────────────────────
          Rendue même sans brief tant qu'il reste quelque chose à droite : le
          pool, les contributeurs et le bouton ne dépendent pas du document.
          Un membre sur téléphone, lui, a déjà tout reçu — la colonne se tairait
          et la section serait vide. ── */}
      {(rest || (!isMember && (pool > 0 || participantCount > 0 || canJoin))) && (
        <section id="brief" className="v-cd-brief">
          <div className="v-cd-brief-inner" data-reveal="true">
            {rest && (
              <article className="v-cd-brief-read">
                <div className="v-cd-brief-head">
                  <p className="v-cd-brief-label">The brief</p>
                  <div className="v-cd-brief-rule" />
                </div>

                <div className="v-cd-md">
                  {/* La page porte déjà son `<h1>` : un brief qui commence par
                      `# Titre` en produirait un second. */}
                  <Markdown source={rest} variant="vitrine" headingOffset={1} />
                </div>

                {!isMember && inviteCaption && <p className="v-cd-brief-note">{inviteCaption}</p>}
                {!isMember && joinError && <p className="v-cd-brief-error">{joinError}</p>}
              </article>
            )}

            <aside className="v-cd-aside">
              {pool > 0 && (
                <div className="v-cd-card">
                  <span className="v-cd-card-label">Reward pool</span>
                  <span className="v-cd-card-value">
                    {formatCP(pool)} <span className="v-cd-card-unit">CP</span>
                  </span>
                  <div className="v-cd-bar">
                    <span style={{ width: `${poolProgress}%` }} />
                  </div>
                  <span className="v-cd-card-meta">
                    {formatCP(awardedTotal)} CP already awarded · the rest is still to win
                  </span>
                </div>
              )}

              {participantCount > 0 && (
                <div className="v-cd-card v-cd-people">
                  <span className="v-cd-card-label">Contributors on it</span>
                  <div className="v-cd-people-row">
                    <div className="v-cd-faces">
                      {faces.map(member => (
                        <VitrineAvatar key={member.id} name={member.fullName} avatarUrl={member.avatarUrl} size="2.125rem" />
                      ))}
                    </div>
                    <span className="v-cd-people-count">
                      {participantCount} participant{participantCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="v-cd-card-meta">Each works on their own branch and their own board.</span>
                </div>
              )}

              {!isMember && canJoin && joinControl('v-cd-join')}
              {/* Sans brief, la légende et l'erreur n'ont pas de colonne de
                  lecture où se poser : elles suivent le bouton. */}
              {!isMember && !rest && inviteCaption && <span className="v-cd-card-meta">{inviteCaption}</span>}
              {!isMember && !rest && joinError && <span className="v-cd-brief-error">{joinError}</span>}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
