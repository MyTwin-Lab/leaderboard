/**
 * Réduit un sandbox à ce que son lecteur a le droit de voir.
 *
 * Construit champ par champ, comme `overview.ts` : une denylist qui
 * supprimerait les clés sensibles publierait par défaut toute colonne qu'un
 * repository se mettrait à renvoyer plus tard. Ici, un champ nouveau reste
 * privé tant que personne ne l'a écrit dans ce fichier.
 *
 * C'est le **seul** endroit où `evaluation`, `evaluation_status`,
 * `evaluated_at` et le détail des rewards sont ajoutés — ou non. Les routes ne
 * font que fournir la matière et le lecteur ; elles ne décident rien.
 *
 * Ne sortent jamais, quel que soit le lecteur : l'email et le
 * `github_username` de l'auteur (le sandbox n'est pas une page de profil), et
 * les `ip_hash` / `anon_id` de qui que ce soit — ils n'apparaissent que dans la
 * route d'audit, réservée aux admins.
 */

/**
 * Qui regarde. Deux formes, calquées sur `StarIdentity` du service : une
 * session, ou une identité anonyme portée par le cookie `sb_anon` (absente
 * tant que le visiteur n'a jamais staré — on ne pose pas de cookie sur un GET).
 */
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
  type: string;
  title: string;
  context: string | null;
  goals: string[];
  why: string | null;
  repo_url: string;
  model_url: string | null;
  dataset_urls: string[];
  status: string;
  promoted_challenge_id: string | null;
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
  /** Auteur et admins seulement. Absents (et non `null`) pour les autres. */
  evaluation?: unknown;
  evaluation_status?: string | null;
  evaluated_at?: string | null;
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
}

/** Dates en ISO : la row porte des `Date`, le JSON n'en a pas. */
function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** L'auteur d'un sandbox voit tout de sa proposition ; un admin aussi (§1.6). */
export function viewerSeesScore(sandbox: { user_id?: string }, viewer: SandboxViewer): boolean {
  if (viewer.kind !== "account") return false;
  return viewer.role === "admin" || sandbox.user_id === viewer.userId;
}

export function toSandboxView(input: SandboxViewInput): SandboxView {
  const s = input.sandbox ?? {};
  const author = input.author;

  const view: SandboxView = {
    uuid: s.uuid,
    user_id: s.user_id,
    type: s.type,
    title: s.title,
    context: s.context ?? null,
    goals: Array.isArray(s.goals) ? s.goals : [],
    why: s.why ?? null,
    repo_url: s.repo_url,
    model_url: s.model_url ?? null,
    dataset_urls: Array.isArray(s.dataset_urls) ? s.dataset_urls : [],
    status: s.status,
    promoted_challenge_id: s.promoted_challenge_id ?? null,
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

  // L'évaluation est formative : elle ne paie rien et n'a pas à être exposée
  // au public, où elle deviendrait un classement officieux des propositions.
  if (viewerSeesScore(s, input.viewer)) {
    view.evaluation = s.evaluation ?? null;
    view.evaluation_status = s.evaluation_status ?? null;
    view.evaluated_at = iso(s.evaluated_at);
    if (input.rewards) {
      view.rewards = input.rewards.map((reward: any) => ({
        uuid: reward.uuid,
        rule_key: reward.rule_key,
        tier_stars: reward.tier_stars ?? null,
        points: reward.points ?? 0,
        created_at: iso(reward.created_at),
      }));
    }
  }

  return view;
}
