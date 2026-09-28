import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db, resource_claims, resource_instances, type DbTransaction } from "../db/drizzle.js";

/** Une ressource (`resource_instances`). */
export interface ResourceInstance {
  uuid: string;
  challenge_id: string;
  resource_type: string;
  payload: Record<string, unknown>;
  class: string | null;
  state: "open" | "closed";
  verdict: string | null;
  resolution: Record<string, unknown> | null;
  created_by: string | null;
  created_at: Date;
  closed_at: Date | null;
}

/** Une réclamation (`resource_claims`). */
export interface ResourceClaim {
  uuid: string;
  resource_id: string;
  challenge_id: string;
  user_id: string;
  result: Record<string, unknown> | null;
  claimed_at: Date;
  expires_at: Date | null;
  consumed_at: Date | null;
  released_at: Date | null;
}

/** Une réclamation consommée, avec ce que sa ressource en dit. */
export interface ConsumedClaim {
  claim_id: string;
  resource_id: string;
  resource_type: string;
  user_id: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  consumed_at: Date;
}

export interface DrawCandidateQuery {
  challengeId: string;
  userId: string;
  type: string;
  /** Sans `k`, aucune borne : seule l'unicité par personne compte. */
  k?: number;
  class?: string;
  excluded: readonly string[];
}

export interface NewClaim {
  resourceId: string;
  challengeId: string;
  userId: string;
  ttlHours?: number;
}

function toInstance(row: typeof resource_instances.$inferSelect): ResourceInstance {
  return {
    ...row,
    payload: row.payload ?? {},
    state: row.state === "closed" ? "closed" : "open",
    resolution: row.resolution ?? null,
  };
}

/** Réclamée et toujours vivante : ni libérée, ni consommée, ni échue. */
const isActive = and(
  isNull(resource_claims.released_at),
  isNull(resource_claims.consumed_at),
  or(isNull(resource_claims.expires_at), gt(resource_claims.expires_at, sql`now()`))
);

/** Ce qui compte dans `k` : les réclamations actives et consommées. */
const countsTowardK = or(isNotNull(resource_claims.consumed_at), isActive);

/**
 * Les opérations d'un tirage, toutes dans la même transaction. La capacité
 * (`packages/capabilities/resources.ts`) les enchaîne ; ce repository ne
 * décide rien.
 */
export class ResourceDrawTransaction {
  constructor(private readonly tx: DbTransaction) {}

  /**
   * Libère les réclamations échues de l'appelant sur ce challenge. L'index
   * unique partiel ne connaît pas l'heure : sans cette libération, une
   * réclamation échue bloquerait à jamais son auteur sur la ressource.
   */
  async releaseExpired(challengeId: string, userId: string): Promise<void> {
    await this.tx
      .update(resource_claims)
      .set({ released_at: sql`${resource_claims.expires_at}` })
      .where(
        and(
          eq(resource_claims.challenge_id, challengeId),
          eq(resource_claims.user_id, userId),
          isNull(resource_claims.consumed_at),
          isNull(resource_claims.released_at),
          lt(resource_claims.expires_at, sql`now()`)
        )
      );
  }

  /**
   * La prochaine ressource ouverte, verrouillée (`FOR UPDATE SKIP LOCKED`) :
   * deux tirages concurrents se répartissent au lieu de s'attendre. Le
   * compte sous `k` n'est ici qu'un préfiltre ; il est refait sous le verrou.
   */
  async nextCandidate(query: DrawCandidateQuery): Promise<{ uuid: string; payload: Record<string, unknown> } | null> {
    const filters: SQL[] = [
      eq(resource_instances.challenge_id, query.challengeId),
      eq(resource_instances.resource_type, query.type),
      eq(resource_instances.state, "open"),
      sql`NOT EXISTS (
        SELECT 1 FROM resource_claims c
        WHERE c.resource_id = ${resource_instances.uuid}
          AND c.user_id = ${query.userId}
          AND c.released_at IS NULL
      )`,
    ];
    if (query.class !== undefined) filters.push(eq(resource_instances.class, query.class));
    if (query.excluded.length > 0) filters.push(notInArray(resource_instances.uuid, [...query.excluded]));
    if (query.k !== undefined) {
      filters.push(sql`(
        SELECT count(*) FROM resource_claims c
        WHERE c.resource_id = ${resource_instances.uuid}
          AND (c.consumed_at IS NOT NULL
               OR (c.released_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > now())))
      ) < ${query.k}`);
    }

    const [row] = await this.tx
      .select({ uuid: resource_instances.uuid, payload: resource_instances.payload })
      .from(resource_instances)
      .where(and(...filters))
      // Ce que l'appelant n'a jamais réclamé d'abord : une ressource passée
      // ou échue ne revient qu'une fois les autres épuisées.
      .orderBy(
        sql`EXISTS (
          SELECT 1 FROM resource_claims c
          WHERE c.resource_id = ${resource_instances.uuid} AND c.user_id = ${query.userId}
        )`,
        asc(resource_instances.created_at),
        asc(resource_instances.uuid)
      )
      .limit(1)
      .for("update", { skipLocked: true });
    return row ? { uuid: row.uuid, payload: row.payload ?? {} } : null;
  }

  /** Les réclamations qui comptent dans `k`, relues sous le verrou de la ressource. */
  async countTowardK(resourceId: string): Promise<number> {
    const [row] = await this.tx
      .select({ total: sql<number>`count(*)::int` })
      .from(resource_claims)
      .where(and(eq(resource_claims.resource_id, resourceId), countsTowardK));
    return row?.total ?? 0;
  }

  /** `null` quand l'appelant a déjà une réclamation vivante sur la ressource (index unique partiel). */
  async insertClaim(claim: NewClaim): Promise<ResourceClaim | null> {
    const [row] = await this.tx
      .insert(resource_claims)
      .values({
        resource_id: claim.resourceId,
        challenge_id: claim.challengeId,
        user_id: claim.userId,
        expires_at: claim.ttlHours !== undefined ? sql`now() + make_interval(hours => ${claim.ttlHours}::int)` : null,
      })
      .onConflictDoNothing({
        target: [resource_claims.resource_id, resource_claims.user_id],
        where: sql`released_at IS NULL`,
      })
      .returning();
    return row ?? null;
  }
}

/**
 * ResourceRepository
 * ------------------
 * Le stockage de la capacité `resources`. Les transitions sont des UPDATE
 * conditionnels : une réclamation ne se consomme qu'une fois, une ressource
 * ne se ferme qu'une fois, et le perdant d'une course obtient `null`.
 */
export class ResourceRepository {
  async createMany(
    challengeId: string,
    type: string,
    items: ReadonlyArray<{ payload: Record<string, unknown>; class?: string | null }>,
    createdBy?: string | null
  ): Promise<number> {
    if (items.length === 0) return 0;
    const inserted = await db
      .insert(resource_instances)
      .values(
        items.map((item) => ({
          challenge_id: challengeId,
          resource_type: type,
          payload: item.payload,
          class: item.class ?? null,
          created_by: createdBy ?? null,
        }))
      )
      .returning({ uuid: resource_instances.uuid });
    return inserted.length;
  }

  inDrawTransaction<T>(run: (tx: ResourceDrawTransaction) => Promise<T>): Promise<T> {
    return db.transaction((tx) => run(new ResourceDrawTransaction(tx)));
  }

  async findResource(resourceId: string): Promise<ResourceInstance | null> {
    const [row] = await db.select().from(resource_instances).where(eq(resource_instances.uuid, resourceId));
    return row ? toInstance(row) : null;
  }

  async findClaim(claimId: string): Promise<ResourceClaim | null> {
    const [row] = await db.select().from(resource_claims).where(eq(resource_claims.uuid, claimId));
    return row ?? null;
  }

  /** La réclamation active la plus ancienne de l'appelant sur ce challenge, avec sa ressource. */
  async findActiveClaim(
    challengeId: string,
    userId: string
  ): Promise<{ claim: ResourceClaim; resource: ResourceInstance } | null> {
    const [row] = await db
      .select({ claim: resource_claims, resource: resource_instances })
      .from(resource_claims)
      .innerJoin(resource_instances, eq(resource_instances.uuid, resource_claims.resource_id))
      .where(and(eq(resource_claims.challenge_id, challengeId), eq(resource_claims.user_id, userId), isActive))
      .orderBy(asc(resource_claims.claimed_at))
      .limit(1);
    return row ? { claim: row.claim, resource: toInstance(row.resource) } : null;
  }

  /** Consomme une réclamation active de `userId`. `null` si elle ne l'est pas (ou plus). */
  async consume(claimId: string, userId: string, result: Record<string, unknown>): Promise<ResourceClaim | null> {
    const [row] = await db
      .update(resource_claims)
      .set({ result, consumed_at: sql`now()` })
      .where(and(eq(resource_claims.uuid, claimId), eq(resource_claims.user_id, userId), isActive))
      .returning();
    return row ?? null;
  }

  /** Libère une réclamation active de `userId`. `false` si elle ne l'est pas (ou plus). */
  async release(claimId: string, userId: string): Promise<boolean> {
    const rows = await db
      .update(resource_claims)
      .set({ released_at: sql`now()` })
      .where(and(eq(resource_claims.uuid, claimId), eq(resource_claims.user_id, userId), isActive))
      .returning({ uuid: resource_claims.uuid });
    return rows.length > 0;
  }

  /** Ferme une ressource ouverte. `null` si elle était déjà fermée. */
  async close(
    resourceId: string,
    verdict: string,
    resolution: Record<string, unknown> | null
  ): Promise<ResourceInstance | null> {
    const [row] = await db
      .update(resource_instances)
      .set({ state: "closed", verdict, resolution, closed_at: sql`now()` })
      .where(and(eq(resource_instances.uuid, resourceId), eq(resource_instances.state, "open")))
      .returning();
    return row ? toInstance(row) : null;
  }

  /**
   * Change le verdict d'une ressource fermée, seulement s'il vaut encore
   * `fromVerdict`, et fusionne `resolution`. `null` sinon.
   */
  async reclose(
    resourceId: string,
    fromVerdict: string,
    verdict: string,
    resolution: Record<string, unknown>
  ): Promise<ResourceInstance | null> {
    const [row] = await db
      .update(resource_instances)
      .set({ verdict, resolution: sql`COALESCE(${resource_instances.resolution}, '{}'::jsonb) || ${JSON.stringify(resolution)}::jsonb` })
      .where(
        and(
          eq(resource_instances.uuid, resourceId),
          eq(resource_instances.state, "closed"),
          eq(resource_instances.verdict, fromVerdict)
        )
      )
      .returning();
    return row ? toInstance(row) : null;
  }

  /**
   * Pose `resolution[key]` sur une ressource fermée qui ne l'a pas encore.
   * `null` si la clé y est déjà : c'est l'idempotence d'un passage.
   */
  async stampResolution(resourceId: string, key: string, value: unknown): Promise<ResourceInstance | null> {
    const [row] = await db
      .update(resource_instances)
      .set({
        resolution: sql`COALESCE(${resource_instances.resolution}, '{}'::jsonb) || jsonb_build_object(${key}::text, ${JSON.stringify(value)}::jsonb)`,
      })
      .where(
        and(
          eq(resource_instances.uuid, resourceId),
          eq(resource_instances.state, "closed"),
          sql`NOT (COALESCE(${resource_instances.resolution}, '{}'::jsonb) ? ${key})`
        )
      )
      .returning();
    return row ? toInstance(row) : null;
  }

  /** Les réclamations consommées, filtrées par ressource, challenge, personne ou type ; les plus récentes d'abord. */
  async consumedClaims(filter: {
    resourceId?: string;
    challengeId?: string;
    userId?: string;
    type?: string;
  }): Promise<ConsumedClaim[]> {
    const filters: SQL[] = [isNotNull(resource_claims.consumed_at)];
    if (filter.resourceId) filters.push(eq(resource_claims.resource_id, filter.resourceId));
    if (filter.challengeId) filters.push(eq(resource_claims.challenge_id, filter.challengeId));
    if (filter.userId) filters.push(eq(resource_claims.user_id, filter.userId));
    if (filter.type) filters.push(eq(resource_instances.resource_type, filter.type));

    const rows = await db
      .select({
        claim_id: resource_claims.uuid,
        resource_id: resource_claims.resource_id,
        resource_type: resource_instances.resource_type,
        user_id: resource_claims.user_id,
        payload: resource_instances.payload,
        result: resource_claims.result,
        consumed_at: resource_claims.consumed_at,
      })
      .from(resource_claims)
      .innerJoin(resource_instances, eq(resource_instances.uuid, resource_claims.resource_id))
      .where(and(...filters))
      .orderBy(desc(resource_claims.consumed_at), desc(resource_claims.uuid));

    return rows.map((row) => ({
      ...row,
      payload: row.payload ?? {},
      result: row.result ?? {},
      consumed_at: row.consumed_at!,
    }));
  }

  async listResources(filter: {
    challengeId?: string;
    challengeIds?: readonly string[];
    type?: string;
    state?: "open" | "closed";
    verdict?: string;
    /** Seulement les ressources dont `resolution` n'a pas cette clé. */
    withoutResolutionKey?: string;
  }): Promise<ResourceInstance[]> {
    const filters: SQL[] = [];
    if (filter.challengeId) filters.push(eq(resource_instances.challenge_id, filter.challengeId));
    if (filter.challengeIds) {
      if (filter.challengeIds.length === 0) return [];
      filters.push(inArray(resource_instances.challenge_id, [...filter.challengeIds]));
    }
    if (filter.type) filters.push(eq(resource_instances.resource_type, filter.type));
    if (filter.state) filters.push(eq(resource_instances.state, filter.state));
    if (filter.verdict) filters.push(eq(resource_instances.verdict, filter.verdict));
    if (filter.withoutResolutionKey) {
      filters.push(sql`NOT (COALESCE(${resource_instances.resolution}, '{}'::jsonb) ? ${filter.withoutResolutionKey})`);
    }

    const rows = await db
      .select()
      .from(resource_instances)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(resource_instances.created_at), asc(resource_instances.uuid));
    return rows.map(toInstance);
  }

  /** Les ressources d'un challenge, comptées par type, état et verdict. */
  async counts(challengeId: string): Promise<Array<{ type: string; state: string; verdict: string | null; total: number }>> {
    const rows = await db
      .select({
        type: resource_instances.resource_type,
        state: resource_instances.state,
        verdict: resource_instances.verdict,
        total: sql<number>`count(*)::int`,
      })
      .from(resource_instances)
      .where(eq(resource_instances.challenge_id, challengeId))
      .groupBy(resource_instances.resource_type, resource_instances.state, resource_instances.verdict);
    return rows;
  }
}
