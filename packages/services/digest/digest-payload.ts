import type {
  Challenge,
  Contribution,
  ContributionMember,
  DigestPayload,
  RewardEntry,
  User,
} from "../../database-service/domain/entities.js";

/**
 * Tout ce que buildDigestPayload consomme, déjà fenêtré par l'appelant.
 *
 * La fonction ne filtre rien par date : le service a fait les requêtes avec les
 * bornes, ici on dénormalise, on résout les groupes et on agrège. C'est ce
 * découpage qui rend la logique intéressante testable sans base.
 */
export interface DigestSource {
  /** Contributions créées dans la fenêtre. */
  contributions: Contribution[];
  /** Parts de groupe des contributions ci-dessus — vide pour du solo. */
  contributionMembers: ContributionMember[];
  challengesCreated: Challenge[];
  challengesClosed: Challenge[];
  /** Utilisateurs créés dans la fenêtre. */
  contributors: User[];
  /** Lignes de ledger écrites dans la fenêtre. */
  rewardEntries: RewardEntry[];
  /** Lookups de dénormalisation. */
  usersById: Map<string, User>;
  challengesById: Map<string, Challenge>;
  projectTitlesById: Map<string, string>;
  /** Total distribué sur toute la vie d'un challenge fermé (pas sur la fenêtre). */
  cpAwardedByChallenge: Map<string, number>;
}

const UNKNOWN_USER = "Unknown";
const UNKNOWN_CHALLENGE = "Unknown challenge";

function nameOf(usersById: Map<string, User>, userId: string): string {
  return usersById.get(userId)?.full_name ?? UNKNOWN_USER;
}

/**
 * Assemble le contenu figé d'un digest.
 *
 * Les quatre premières sections sont des sections d'apparition : elles ne
 * voient un objet qu'une fois. `cp_distributed` lit le ledger et capte donc ce
 * qu'une ré-évaluation rapporte à une contribution créée avant la fenêtre —
 * invisible autrement, alors que c'est le mode de travail normal d'un challenge
 * `code`. Voir docs/input/spec-digest.md §4.
 */
export function buildDigestPayload(source: DigestSource): DigestPayload {
  const {
    contributions, contributionMembers, challengesCreated, challengesClosed,
    contributors, rewardEntries, usersById, challengesById, projectTitlesById,
    cpAwardedByChallenge,
  } = source;

  // Membres regroupés par contribution. Une contribution sans entrée ici est
  // solo — c'est le cas normal, pas une anomalie (cf. challenge-groups.md).
  const membersByContribution = new Map<string, string[]>();
  for (const m of contributionMembers) {
    const list = membersByContribution.get(m.contribution_id) ?? [];
    list.push(m.user_id);
    membersByContribution.set(m.contribution_id, list);
  }

  const new_contributions = contributions.map((c) => {
    const memberIds = membersByContribution.get(c.uuid);
    // Le porteur d'abord : c'est lui que porte contributions.user_id, et le
    // lire en tête évite un ordre arbitraire hérité de la requête. Il peut
    // aussi avoir sa propre row de membre, d'où le filtre.
    const ids = memberIds
      ? [c.user_id, ...memberIds.filter((id) => id !== c.user_id)]
      : [c.user_id];
    return {
      contribution_id: c.uuid,
      title: c.title,
      type: c.type,
      challenge_id: c.challenge_id,
      challenge_title: challengesById.get(c.challenge_id)?.title ?? UNKNOWN_CHALLENGE,
      contributors: ids.map((id) => ({ user_id: id, full_name: nameOf(usersById, id) })),
      // Reward global de la contribution : la part individuelle vit dans
      // contribution_members et n'a pas de sens au niveau du digest.
      reward_cp: c.reward,
    };
  });

  const new_challenges = challengesCreated.map((ch) => ({
    challenge_id: ch.uuid,
    title: ch.title,
    type: ch.type,
    project_title: projectTitlesById.get(ch.project_id) ?? "",
    reward_pool: ch.contribution_points_reward,
  }));

  const completed_challenges = challengesClosed.map((ch) => ({
    challenge_id: ch.uuid,
    title: ch.title,
    type: ch.type,
    closed_at: (ch.closed_at ?? new Date(0)).toISOString(),
    reward_pool: ch.contribution_points_reward,
    cp_awarded: cpAwardedByChallenge.get(ch.uuid) ?? 0,
  }));

  const new_contributors = contributors.map((u) => ({
    user_id: u.uuid,
    full_name: u.full_name,
    role: u.role,
    joined_at: (u.created_at ?? new Date(0)).toISOString(),
  }));

  // Agrégat du ledger par (user, challenge). Le ledger brut serait illisible
  // sur plusieurs semaines ; `by_rule` garde la nature de l'attribution sans
  // lister chaque row. Les prélèvements de réutilisation sont des points
  // négatifs et se compensent naturellement dans le total.
  const cpByKey = new Map<string, {
    user_id: string; challenge_id: string; total_cp: number; by_rule: Record<string, number>;
  }>();
  for (const e of rewardEntries) {
    const key = `${e.user_id}::${e.challenge_id}`;
    const row = cpByKey.get(key)
      ?? { user_id: e.user_id, challenge_id: e.challenge_id, total_cp: 0, by_rule: {} };
    row.total_cp += e.points;
    row.by_rule[e.rule_key] = (row.by_rule[e.rule_key] ?? 0) + e.points;
    cpByKey.set(key, row);
  }

  const cp_distributed = [...cpByKey.values()]
    .map((row) => ({
      ...row,
      full_name: nameOf(usersById, row.user_id),
      challenge_title: challengesById.get(row.challenge_id)?.title ?? UNKNOWN_CHALLENGE,
    }))
    .sort((a, b) => b.total_cp - a.total_cp);

  return {
    version: 1,
    new_contributions,
    new_challenges,
    completed_challenges,
    new_contributors,
    cp_distributed,
  };
}
