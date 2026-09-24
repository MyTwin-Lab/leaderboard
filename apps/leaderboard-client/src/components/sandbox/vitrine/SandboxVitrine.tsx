'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

import { Markdown } from '@/components/ui/Markdown';
import { VitrineAvatar } from '@/components/vitrine/VitrineAvatar';
import { vitrineFontVars } from '@/components/vitrine/fonts';
import { useVitrineChrome } from '@/components/challenges/vitrine/useVitrineChrome';
import { coverShot } from '@/lib/coverImage';
import { formatCP } from '@/lib/formatters';
import { leadAndBody, stripInlineMarkdown } from '@/lib/briefSections';
import { challengePath } from '@/lib/paths';
import type { SandboxView } from '@/lib/public/sandbox';
import { useStarToggle, type StarState } from '../StarButton';
import { nextTier, sortTiers, tierProgress } from '../../../../../../packages/services/sandbox/starTiers';
import type { SandboxStarTier } from '../../../../../../packages/database-service/domain/entities';

import '@/components/vitrine/vitrine.css';
import '@/components/challenges/vitrine/challenge-vitrine.css';
import './sandbox-detail-vitrine.css';

/**
 * La page d'un sandbox — d'après `Sandbox Vitrine.dc.html`.
 *
 * Elle remplace l'écran sombre précédent par celui de la maquette : un hero
 * photo, le pourquoi de la proposition, qui la porte, puis la proposition
 * elle-même en colonne de lecture avec les paliers de stars à droite.
 *
 * **Un sandbox est un projet, pas un challenge en attente.** Trois choses de
 * l'écran précédent ont disparu avec cette bascule, et ce n'est pas un oubli :
 * le badge de type (`code` / `ml`, le vocabulaire des challenges), les pastilles
 * de dépôt, de dataset et de modèle (une proposition est une idée, pas un début
 * de livrable), et le panneau d'évaluation formative — il notait un dépôt
 * GitHub sur la grille `code`, c'est-à-dire qu'il lisait une proposition comme
 * un challenge. Ce qui fait avancer un projet ici, ce sont ses stars.
 *
 * Trois écarts assumés avec la maquette. Deux ont été demandés avec elle : la
 * ligne de mesures posée sur la photo et les trois chiffres d'impact à droite
 * de « Why this sandbox exists » ne sont pas rendus — les stars et les paliers
 * vivent dans la colonne de droite, et les répéter sur le hero donnait deux
 * fois le même chiffre. Le troisième suit du modèle : la carte « Repository »
 * de la section auteur n'a plus d'objet.
 *
 * Deux mises en page, comme la maquette : l'écran et le téléphone. Elles se
 * distinguent en CSS, à 768px.
 */

interface SandboxVitrineProps {
  sandbox: SandboxView;
  tiers: SandboxStarTier[];
  promotionBonusCp: number;
  currentUserId: string | null;
  isAdmin: boolean;
  onEdit: () => void;
  onArchive: () => void;
  /** Ouvre le tiroir de promotion. Absent = aucun bouton (lecteur non admin). */
  onPromote?: () => void;
  archiving?: boolean;
  onStarState?: (state: StarState) => void;
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dateFmt.format(date);
}

/**
 * La roue d'illustrations de repli est indexée sur la position dans un
 * listing ; une page de détail n'en a pas. L'UUID en tient lieu : stable d'une
 * visite à l'autre, et la même photo que dans la liste n'est pas recherchée —
 * seule une couverture posée par l'auteur garantit les deux.
 */
function shotIndex(uuid: string): number {
  let sum = 0;
  for (let i = 0; i < uuid.length; i++) sum += uuid.charCodeAt(i);
  return sum;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  );
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open sandbox',
  promoted: 'Promoted',
  archived: 'Archived',
};

export function SandboxVitrine({
  sandbox,
  tiers,
  promotionBonusCp,
  currentUserId,
  isAdmin,
  onEdit,
  onArchive,
  onPromote,
  archiving = false,
  onStarState,
}: SandboxVitrineProps) {
  useVitrineChrome(true);

  const rootRef = useRef<HTMLDivElement>(null);

  // Le réarmement de la maquette, repris de `ChallengeVitrine` : une mesure du
  // rectangle au défilement, et le filet de sécurité qui découvre tout au bout
  // de 2,5 s. `data-reveal-ready` est posé ici et non dans le JSX — le HTML
  // servi (celui que lisent les moteurs) montre tout, et l'animation ne
  // commence qu'une fois le script en place.
  useEffect(() => {
    const root = rootRef.current;
    if (root) root.dataset.revealReady = '1';
    const reveal = () => {
      const height = window.innerHeight || 800;
      document.querySelectorAll<HTMLElement>('.v-sd [data-reveal]').forEach((el) => {
        if (el.dataset.revealed) return;
        if (el.getBoundingClientRect().top < height * 0.92) el.dataset.revealed = '1';
      });
    };
    window.addEventListener('scroll', reveal, { passive: true });
    window.addEventListener('resize', reveal);
    reveal();
    const safety = setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.v-sd [data-reveal]').forEach((el) => {
        el.dataset.revealed = '1';
      });
    }, 2500);
    return () => {
      clearTimeout(safety);
      window.removeEventListener('scroll', reveal);
      window.removeEventListener('resize', reveal);
    };
  }, []);

  const isAuthor = currentUserId !== null && sandbox.user_id === currentUserId;
  const isOpen = sandbox.status === 'open';
  const promoted = sandbox.status === 'promoted';

  /**
   * **Une seule bascule pour les deux boutons.** La maquette pose l'étoile sur
   * la photo et dans la colonne de droite ; deux `useStarToggle` distincts
   * auraient chacun leur compteur optimiste, et cliquer sur l'un aurait laissé
   * l'autre en arrière.
   */
  const star = useStarToggle({
    sandboxId: sandbox.uuid,
    starCount: sandbox.star_count,
    myStar: sandbox.my_star,
    disabled: isAuthor || !isOpen,
    onState: onStarState,
  });
  const starDisabled = isAuthor || !isOpen;
  const starReason = isAuthor
    ? 'You can’t star your own sandbox'
    : 'This sandbox is no longer open to stars';
  const starLabel = starDisabled ? 'Stars' : star.starred ? 'Starred' : 'Star this sandbox';

  const shot = coverShot(sandbox.cover_image_url, shotIndex(sandbox.uuid), 'sandbox');
  const proposedOn = formatDate(sandbox.created_at);

  // Le contexte se coupe en deux comme le brief d'un challenge : son premier
  // paragraphe est l'accroche posée sur la photo, le reste ouvre la
  // proposition. Sans reste, l'accroche ne vit que sur le hero — la répéter
  // deux écrans plus bas n'apprendrait rien.
  const { lead: contextLead, body: contextBody } = leadAndBody(sandbox.context ?? '');
  const heroLede = contextLead ? stripInlineMarkdown(contextLead) : '';
  const ideaSource = contextBody.join('\n\n');

  const { lead: whyLead, body: whyBody } = leadAndBody(sandbox.why ?? '');
  const whyBodyText = whyBody.join('\n\n');

  const ordered = sortTiers(tiers);
  const paid = new Set(sandbox.paid_tier_thresholds);
  const progress = tierProgress(star.count, ordered);
  const upcoming = nextTier(star.count, ordered);
  // Le total payé est sommé depuis les seuils réellement payés, et non repris
  // du `hint` de `tierProgress` : celui-ci additionne les paliers configurés,
  // et devient optimiste dès qu'un admin a supprimé une reward après un
  // nettoyage anti-abus (docs/sandbox.md).
  const paidCP = ordered.filter((tier) => paid.has(tier.stars)).reduce((sum, tier) => sum + tier.cp, 0);
  const tierHint =
    ordered.length === 0 || upcoming
      ? progress.hint
      : `All milestones reached · ${formatCP(paidCP)} CP paid`;

  // Sans `|| isOpen` : le bloc qui rendait toute proposition ouverte lisible —
  // « What promotion would change » — n'existe plus. Une proposition sans idée
  // ni but n'a donc plus rien à lire, et le lien du hero n'a plus lieu de
  // descendre vers un article vide.
  const hasProposal = !!ideaSource || sandbox.goals.length > 0;

  /**
   * « Read the proposal » descend, il ne saute pas — même geste que sur la page
   * d'un challenge. `scrollIntoView` ignore `prefers-reduced-motion`, d'où la
   * vérification explicite : le saut reste la bonne réponse pour qui demande
   * moins d'animation.
   */
  const scrollToProposal = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById('proposal');
    if (!target) return;
    event.preventDefault();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#proposal');
  };

  const starButton = (className: string) => (
    <button
      type="button"
      className={className}
      onClick={star.toggle}
      disabled={starDisabled || star.pending}
      data-on={star.starred ? 'true' : undefined}
      data-off={starDisabled ? 'true' : undefined}
      title={starDisabled ? starReason : undefined}
      aria-pressed={star.starred}
      aria-label={`${star.starred ? 'Unstar' : 'Star'} this sandbox`}
    >
      <StarIcon filled={star.starred} />
      {starLabel}
      <span className="v-sd-star-count">{star.count}</span>
    </button>
  );

  return (
    <div ref={rootRef} className={`vitrine v-cd v-sd ${vitrineFontVars}`}>
      {/* ── L'en-tête de la maquette téléphone : retour, et le compteur ── */}
      <div className="v-sd-mobile-bar">
        <Link href="/sandbox" className="v-sd-back">
          <ArrowLeftIcon />
          Sandbox
        </Link>
        <span className="v-sd-mobile-stars">
          <StarIcon filled />
          <b>{star.count}</b>
          <span>stars</span>
        </span>
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
              <span className="v-cd-status" data-status={sandbox.status} data-live={isOpen ? 'true' : undefined}>
                <span className="v-cd-status-dot" />
                {STATUS_LABELS[sandbox.status] ?? sandbox.status}
              </span>
              <span className="v-cd-kind">
                Project{proposedOn ? ` · Proposed ${proposedOn}` : ''}
              </span>
              {sandbox.author && (
                <>
                  <span className="v-sd-sep">·</span>
                  <span className="v-cd-kind">
                    By {isAuthor ? 'you' : sandbox.author.full_name}
                  </span>
                </>
              )}
            </div>

            <div className="v-cd-hero-foot">
              <h1 className="v-cd-hero-title">{sandbox.title}</h1>

              {heroLede && <p className="v-cd-hero-lede">{heroLede}</p>}

              <div className="v-cd-actions">
                {starButton('v-sd-hero-star')}
                {hasProposal && (
                  <a href="#proposal" onClick={scrollToProposal} className="v-cd-cta-ghost">
                    Read the proposal
                  </a>
                )}
              </div>

              {star.error && <p className="v-sd-hero-error">{star.error}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* ── Ce que la maquette n'a pas : les gestes de l'auteur et de l'admin.
             Posés sous la photo, sur le fond clair — ce sont des commandes, pas
             un appel à l'action, et les mettre sur le hero les aurait mises au
             même rang que l'étoile. ── */}
      {(isAuthor || isAdmin) && (
        <section className="v-sd-tools">
          {isAuthor && <span className="v-sd-tools-label">Your project</span>}
          {isAuthor && isOpen && (
            <button type="button" className="v-sd-tool" onClick={onEdit}>
              <PencilIcon />
              Edit
            </button>
          )}
          {/* Promouvoir : l'admin seul (§1.6), et seulement sur une proposition
              encore ouverte — la promotion est définitive. */}
          {isAdmin && onPromote && isOpen && (
            <button type="button" className="v-sd-tool" data-primary="true" onClick={onPromote}>
              <ArrowUpIcon />
              Promote to challenge
            </button>
          )}
          {/* Archiver : l'auteur pour le sien, l'admin pour n'importe lequel. */}
          {(isAuthor || isAdmin) && sandbox.status !== 'archived' && (
            <button
              type="button"
              className="v-sd-tool"
              data-danger="true"
              onClick={onArchive}
              disabled={archiving}
            >
              <ArchiveIcon />
              {archiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
        </section>
      )}

      {promoted && (
        <section className="v-sd-promoted">
          <div className="v-sd-promoted-card">
            <ArrowUpIcon />
            <span className="v-sd-promoted-title">Promoted to an official challenge</span>
            {(sandbox.promoted_challenge_slug ?? sandbox.promoted_challenge_id) && (
              <Link
                href={challengePath(sandbox.promoted_challenge_slug ?? sandbox.promoted_challenge_id!)}
                className="v-sd-promoted-link"
              >
                See the challenge →
              </Link>
            )}
            <span className="v-sd-promoted-meta">
              The author was auto-joined
              {promotionBonusCp > 0 ? ` · ${formatCP(promotionBonusCp)} CP bonus paid` : ''}
            </span>
          </div>
        </section>
      )}

      {/* ── « Why this sandbox exists », et l'auteur à sa droite ─────────

          Une seule rangée pour les deux. La maquette pose trois chiffres
          d'impact dans cette colonne de droite ; ils ne sont pas rendus, et la
          carte de l'auteur — qui vivait en pleine largeur juste en dessous —
          vient l'occuper plutôt que de laisser le texte courir seul.

          Elle y est **sticky**, comme les paliers de stars le sont le long de
          la proposition : qui la porte reste sous les yeux pendant qu'on lit
          le pourquoi. ── */}
      {(whyLead || sandbox.author) && (
        <section className="v-sd-why">
          <div className="v-sd-why-row" data-reveal="true">
            {whyLead && (
              <div className="v-sd-why-text">
                <p className="v-cd-eyebrow">Why this sandbox exists</p>
                <h2 className="v-cd-why-lead">{stripInlineMarkdown(whyLead)}</h2>
                {whyBodyText && (
                  <div className="v-cd-md v-cd-why-body">
                    <Markdown source={whyBodyText} variant="vitrine" headingOffset={2} userContent />
                  </div>
                )}
              </div>
            )}

            {sandbox.author && (
              <aside className="v-sd-author">
                <div className="v-sd-author-card">
                  <p className="v-cd-host-label">Who proposed this sandbox</p>
                  <Link href={`/contributors/${sandbox.author.uuid}`} className="v-sd-author-id">
                    <span className="v-sd-author-face">
                      <VitrineAvatar name={sandbox.author.full_name} avatarUrl={sandbox.author.avatar_url} size="2.75rem" ring={false} />
                    </span>
                    <span className="v-sd-author-names">
                      <span className="v-sd-author-name">{sandbox.author.full_name}</span>
                      <span className="v-sd-author-meta">
                        Contributor{proposedOn ? ` · proposed ${proposedOn}` : ''}
                      </span>
                    </span>
                  </Link>
                </div>
              </aside>
            )}
          </div>
        </section>
      )}

      {/* ── The proposal ───────────────────────────────────────────────── */}
      <section id="proposal" className="v-sd-proposal">
        <div className="v-cd-brief-inner" data-reveal="true">
          <article className="v-cd-brief-read">
            <div className="v-cd-brief-head">
              <p className="v-cd-brief-label">The proposal</p>
              <div className="v-cd-brief-rule" />
            </div>

            {ideaSource && (
              <div className="v-sd-block">
                <h2 className="v-sd-block-title">The idea</h2>
                <div className="v-cd-md">
                  <Markdown source={ideaSource} variant="vitrine" headingOffset={2} userContent />
                </div>
              </div>
            )}

            {sandbox.goals.length > 0 && (
              <div className="v-sd-block">
                <h2 className="v-sd-block-title">Goals</h2>
                <ul className="v-md-ul">
                  {sandbox.goals.map((goal, index) => (
                    <li key={`${index}-${goal}`} className="v-md-li">
                      <span className="v-md-bullet" />
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <aside className="v-cd-aside">
            <div className="v-sd-tiers">
              <div className="v-sd-tiers-head">
                <span className="v-cd-card-label">Star milestones</span>
                <span className="v-sd-tiers-count">
                  {star.count} star{star.count !== 1 ? 's' : ''}
                </span>
              </div>

              {ordered.length === 0 ? (
                <p className="v-sd-tiers-empty">
                  No milestone is configured yet — stars are a signal here, and pay nothing.
                </p>
              ) : (
                <>
                  <ol className="v-sd-tier-list">
                    {ordered.map((tier) => {
                      const isPaid = paid.has(tier.stars);
                      return (
                        <li key={tier.stars} className="v-sd-tier" data-paid={isPaid ? 'true' : undefined}>
                          <StarIcon filled={isPaid} />
                          <span className="v-sd-tier-threshold">{tier.stars} stars</span>
                          <span className="v-sd-tier-cp">+{formatCP(tier.cp)} CP</span>
                          <span className="v-sd-tier-state">{isPaid ? 'paid' : 'pending'}</span>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="v-sd-tier-progress">
                    <div className="v-cd-bar">
                      <span style={{ width: `${progress.pct}%` }} />
                    </div>
                    <span className="v-cd-card-meta">{tierHint}</span>
                  </div>
                </>
              )}
            </div>

            {starButton('v-sd-aside-star')}
            {star.error && <span className="v-sd-aside-error">{star.error}</span>}
          </aside>
        </div>
      </section>
    </div>
  );
}
