import { db } from "../db/drizzle";
import { contributions, users, challenges } from "../db/drizzle";
import { eq, and, gte, lt, or, sql } from "drizzle-orm";
import { toDomainContribution, toDomainUser, toDomainChallenge, toDbContribution } from "../db/mappers";
import type { Contribution, User, Challenge } from "../domain/entities";
import { contributionSchema } from "../domain/schemas_zod";

/**
 * Au-delà de ce délai, un statut `running` est tenu pour orphelin : le process
 * qui portait le run est mort en route (redéploiement, crash) sans poser
 * `done` ni `failed`. Un run réel dure des dizaines de secondes ; 30 minutes
 * laissent une marge large sans bloquer le bouton indéfiniment.
 *
 * Le run est daté par `submitted_at`, que `claimEvaluation` réécrit à chaque
 * prise.
 */
export const EVALUATION_STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Pendant JS de la garde SQL de `claimEvaluation` : ce que `canEvaluate` dit
 * à l'UI doit être ce que la base acceptera.
 */
export function isEvaluationRunning(
  contribution: Pick<Contribution, "evaluation_status" | "submitted_at">,
  now: Date = new Date()
): boolean {
  if (contribution.evaluation_status !== "running") return false;
  return now.getTime() - contribution.submitted_at.getTime() < EVALUATION_STALE_AFTER_MS;
}

export class ContributionRepository {
  async findAll(): Promise<Contribution[]> {
    const rows = await db.select().from(contributions);
    return rows.map(toDomainContribution);
  }

  async findById(uuid: string): Promise<Contribution | null> {
    const [row] = await db.select().from(contributions).where(eq(contributions.uuid, uuid));
    return row ? toDomainContribution(row) : null;
  }


  /**
   * Fenêtre [start, end) — bornes half-open, pour qu'une row tombant
   * exactement sur une borne appartienne à exactement un digest.
   */
  async findCreatedBetween(start: Date, end: Date): Promise<Contribution[]> {
    const rows = await db
      .select()
      .from(contributions)
      .where(and(gte(contributions.created_at, start), lt(contributions.created_at, end)));
    return rows.map(toDomainContribution);
  }

  async findByUser(userId: string): Promise<Contribution[]> {
    const rows = await db.select().from(contributions).where(eq(contributions.user_id, userId));
    return rows.map(toDomainContribution);
  }

  async findByTaskAndUser(taskId: string, userId: string): Promise<Contribution | null> {
    const [row] = await db
      .select()
      .from(contributions)
      .where(and(eq(contributions.task_id, taskId), eq(contributions.user_id, userId)));
    return row ? toDomainContribution(row) : null;
  }

  async findByChallenge(challengeId: string): Promise<Contribution[]> {
    const rows = await db.select().from(contributions).where(eq(contributions.challenge_id, challengeId));
    return rows.map(toDomainContribution);
  }

  async findDetailed(uuid: string): Promise<{ contribution: Contribution; user: User | null; challenge: Challenge | null } | null> {
    const [result] = await db
      .select({
        contribution: contributions,
        user: users,
        challenge: challenges,
      })
      .from(contributions)
      .leftJoin(users, eq(users.uuid, contributions.user_id))
      .leftJoin(challenges, eq(challenges.uuid, contributions.challenge_id))
      .where(eq(contributions.uuid, uuid));

    if (!result) return null;

    return {
      contribution: toDomainContribution(result.contribution),
      user: result.user ? toDomainUser(result.user) : null,
      challenge: result.challenge ? toDomainChallenge(result.challenge) : null,
    };
  }

  async create(entity: Omit<Contribution, "uuid" | "created_at">): Promise<Contribution> {
    const validated = contributionSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const dbData = toDbContribution(validated);
    const [inserted] = await db.insert(contributions).values(dbData).returning();
    return toDomainContribution(inserted);
  }

  /**
   * Création d'une contribution unique par (challenge, user, type), sûre face
   * aux appels concurrents.
   *
   * La table n'a pas d'index unique sur ce triplet : pas d'ON CONFLICT
   * possible sans migration. Un verrou consultatif de transaction sérialise à
   * la place les créateurs d'un même triplet — le second attend, relit, trouve
   * la ligne du premier et ne crée rien. Le verrou tombe avec la transaction.
   *
   * Seuls les appelants qui passent par cette méthode sont sérialisés : un
   * `create` direct sur le même triplet reste possible.
   */
  async createIfAbsent(
    entity: Omit<Contribution, "uuid" | "created_at">
  ): Promise<{ contribution: Contribution; created: boolean }> {
    const validated = contributionSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const lockKey = `${validated.challenge_id}:${validated.user_id}:${validated.type}`;

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('contributions'), hashtext(${lockKey}::text))`
      );

      // Lue après le verrou : en READ COMMITTED, cette requête voit la ligne
      // qu'un créateur concurrent vient de valider en relâchant le verrou.
      const [existing] = await tx
        .select()
        .from(contributions)
        .where(and(
          eq(contributions.challenge_id, validated.challenge_id),
          eq(contributions.user_id, validated.user_id),
          eq(contributions.type, validated.type)
        ))
        .limit(1);
      if (existing) return { contribution: toDomainContribution(existing), created: false };

      const [inserted] = await tx.insert(contributions).values(toDbContribution(validated)).returning();
      return { contribution: toDomainContribution(inserted), created: true };
    });
  }

  /**
   * Prise d'un run d'évaluation : compare-and-set sur `evaluation_status`.
   *
   * Un seul UPDATE conditionnel, pour que deux lancements concurrents ne
   * puissent pas passer tous les deux : le second trouve `running` et
   * n'obtient aucune ligne. `submitted_at` (« dernière soumission ») est
   * réécrit dans le même geste ; c'est lui qui date le run en cours et permet
   * de reprendre la main sur un `running` orphelin (EVALUATION_STALE_AFTER_MS).
   *
   * Retourne la contribution prise, ou `null` si un run est déjà en vol.
   */
  async claimEvaluation(
    uuid: string,
    patch: { artifact_url?: string | null } = {}
  ): Promise<Contribution | null> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - EVALUATION_STALE_AFTER_MS);

    const [claimed] = await db
      .update(contributions)
      .set({
        evaluation_status: "running",
        submitted_at: now,
        ...(patch.artifact_url !== undefined ? { artifact_url: patch.artifact_url || null } : {}),
      })
      .where(and(
        eq(contributions.uuid, uuid),
        or(
          // IS DISTINCT FROM et non `<>` : un statut NULL doit rester prenable.
          sql`${contributions.evaluation_status} IS DISTINCT FROM 'running'`,
          lt(contributions.submitted_at, staleBefore)
        )
      ))
      .returning();
    return claimed ? toDomainContribution(claimed) : null;
  }

  async update(uuid: string, entity: Partial<Omit<Contribution, "uuid">>): Promise<Contribution> {
    const validated = contributionSchema.omit({ uuid: true }).partial().parse(entity);
    const dbData: any = {};
    if (validated.title) dbData.title = validated.title;
    if (validated.type) dbData.type = validated.type;
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.evaluation !== undefined) dbData.evaluation = validated.evaluation;
    if (validated.tags !== undefined) dbData.tags = validated.tags.length > 0 ? validated.tags : null;
    if (validated.reward !== undefined) dbData.reward = validated.reward;
    if (validated.user_id) dbData.user_id = validated.user_id;
    if (validated.challenge_id) dbData.challenge_id = validated.challenge_id;
    if (validated.artifact_url !== undefined) dbData.artifact_url = validated.artifact_url || null;
    if (validated.live_endpoint_url !== undefined) dbData.live_endpoint_url = validated.live_endpoint_url || null;
    if (validated.evaluation_status !== undefined) dbData.evaluation_status = validated.evaluation_status;

    const [updated] = await db.update(contributions)
      .set(dbData)
      .where(eq(contributions.uuid, uuid))
      .returning();
    return toDomainContribution(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(contributions).where(eq(contributions.uuid, uuid));
  }
}
