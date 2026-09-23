/**
 * Réduit un sandbox à ce que son lecteur a le droit de voir.
 *
 * Construit champ par champ, comme `overview.ts` : une denylist qui
 * supprimerait les clés sensibles publierait par défaut toute colonne qu'un
 * repository se mettrait à renvoyer plus tard. Ici, un champ nouveau reste
 * privé tant que personne ne l'a écrit dans ce fichier.
 *
 * C'est le **seul** endroit où le détail des rewards est ajouté — ou non. Les
 * routes ne font que fournir la matière et le lecteur ; elles ne décident rien.
 *
 * Ne sortent jamais, quel que soit le lecteur : l'email et le
 * `github_username` de l'auteur (le sandbox n'est pas une page de profil), et
 * les `ip_hash` / `anon_id` de qui que ce soit — ils n'apparaissent que dans la
 * route d'audit, réservée aux admins.
 *
 * N'existent plus du tout côté base : le type, le dépôt et les URLs ML. Une
 * proposition est une idée, pas un début de livrable (migration 0025).
 */

/**
 * Qui regarde. Deux formes, calquées sur `StarIdentity` du service : une
 * session, ou une identité anonyme portée par le cookie `sb_anon` (absente
 * tant que le visiteur n'a jamais staré — on ne pose pas de cookie sur un GET).
 */
import type { SandboxStarTier } from "../../../../../packages/database-service/domain/entities";

/**
 * Ce que sert `GET /api/sandboxes` : le listing, et les réglages d'instance
 * qui l'accompagnent. Partagé avec la page d'une proposition, qui s'y sert
 * pour s'afficher sans attendre son propre fetch — la liste porte déjà la
 * proposition entière.
 */
export interface SandboxListResponse {
  sandboxes: SandboxView[];
  tiers: SandboxStarTier[];
  promotion_bonus_cp: number;
}

/** Ce que sert `GET /api/sandboxes/[id]` : une proposition, mêmes réglages. */
export interface SandboxDetailResponse {
  sandbox: SandboxView;
  tiers: SandboxStarTier[];
  promotion_bonus_cp: number;
}

export type SandboxViewer =
  | { kind: "anonymous"; anonId: string | null }
  | { kind: "account"; userId: string; role: string };

/** L'auteur, réduit à ce qu'une carte affiche. Ni email, ni github_username. */
export interface SandboxAuthorView {
  uuid: string;
  full_name: string;
  avatar_url: string | null;
}

/**
 * Une ligne du ledger sandbox. Servie à l'auteur et aux admins seulement : les
 * CP touchés par quelqu'un sur sa proposition ne regardent pas les visiteurs,
 * alors que les seuils franchis (`paid_tier_thresholds`), eux, sont publics.
 */
export interface SandboxRewardView {
  uuid: string;
  rule_key: string;
  tier_stars: number | null;
  points: number;
  created_at: string | null;
}

export interface SandboxView {
  uuid: string;
  user_id: string;
  title: string;
  slug: string;
  context: string | null;
  goals: string[];
  why: string | null;
  /** L'image de couverture, posée par l'auteur. `null` = illustration par défaut. */
  cover_image_url: string | null;
  status: string;
  promoted_challenge_id: string | null;
  /**
   * Le slug du challenge issu de la promotion, pour lier sa page. Même
   * exposition que `promoted_challenge_id` : l'UUID redirige de toute façon
   * vers ce slug. `null` tant que la proposition n'est pas promue, ou si la
   * route ne l'a pas chargé.
   */
  promoted_challenge_slug: string | null;
  promoted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  author: SandboxAuthorView | null;
  star_count: number;
  my_star: boolean;
  /**
   * Les seuils réellement payés, lus dans `sandbox_rewards` — jamais déduits
   * du compteur. Le rattachement des stars anonymes à un compte peut faire
   * passer `star_count` sous un seuil déjà payé, et un palier n'est jamais
   * repris. Donnée non sensible : c'est l'état d'avancement de la proposition.
   */
  paid_tier_thresholds: number[];
  /** Auteur et admins seulement. Absent (et non `null`) pour les autres. */
  rewards?: SandboxRewardView[];
}

/** Ce que la route rassemble avant de laisser ce fichier trancher. */
export interface SandboxViewInput {
  /** La row telle qu'elle sort du repository. */
  sandbox: any;
  viewer: SandboxViewer;
  author?: any | null;
  starCount: number;
  myStar: boolean;
  paidTierThresholds: number[];
  /** Le ledger du sandbox, si la route l'a chargé (page détail). */
  rewards?: any[];
  /** Le slug du challenge promu, lu par la route — voir `SandboxView.promoted_challenge_slug`. */
  promotedChallengeSlug?: string | null;
}

/** Dates en ISO : la row porte des `Date`, le JSON n'en a pas. */
function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** L'auteur d'un sandbox voit tout de sa proposition ; un admin aussi (§1.6). */
export function viewerIsAuthorOrAdmin(sandbox: { user_id?: string }, viewer: SandboxViewer): boolean {
  if (viewer.kind !== "account") return false;
  return viewer.role === "admin" || sandbox.user_id === viewer.userId;
}

export function toSandboxView(input: SandboxViewInput): SandboxView {
  const s = input.sandbox ?? {};
  const author = input.author;

  const view: SandboxView = {
    uuid: s.uuid,
    user_id: s.user_id,
    title: s.title,
    slug: s.slug,
    context: s.context ?? null,
    goals: Array.isArray(s.goals) ? s.goals : [],
    why: s.why ?? null,
    cover_image_url: s.cover_image_url ?? null,
    status: s.status,
    promoted_challenge_id: s.promoted_challenge_id ?? null,
    promoted_challenge_slug: s.promoted_challenge_id ? input.promotedChallengeSlug ?? null : null,
    promoted_at: iso(s.promoted_at),
    created_at: iso(s.created_at),
    updated_at: iso(s.updated_at),
    // Trois champs et pas un de plus : `email` et `github_username` ne sortent
    // jamais d'ici, même quand l'appelant passe la row utilisateur entière.
    author: author
      ? {
          uuid: author.uuid,
          full_name: author.full_name,
          avatar_url: author.avatar_url ?? null,
        }
      : null,
    star_count: input.starCount,
    my_star: input.myStar,
    paid_tier_thresholds: input.paidTierThresholds ?? [],
  };

  // Le ledger d'une proposition — ce que ses paliers ont payé — ne regarde que
  // son auteur et les admins. Les seuils franchis, eux, sont publics : ils
  // disent l'avancement, pas les CP de quelqu'un.
  if (input.rewards && viewerIsAuthorOrAdmin(s, input.viewer)) {
    view.rewards = input.rewards.map((reward: any) => ({
      uuid: reward.uuid,
      rule_key: reward.rule_key,
      tier_stars: reward.tier_stars ?? null,
      points: reward.points ?? 0,
      created_at: iso(reward.created_at),
    }));
  }

  return view;
}
