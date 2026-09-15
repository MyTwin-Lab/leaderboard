import { db, platform_events } from "../db/drizzle";
import { and, asc, eq, gt, lt } from "drizzle-orm";

export interface StoredPlatformEvent {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

/**
 * Ce qui écrit un événement : la base, ou la transaction de l'action qui
 * l'émet, pour que l'événement n'existe que si l'action a réussi.
 */
export interface EventExecutor {
  insert: typeof db.insert;
}

/**
 * PlatformEventRepository
 * -----------------------
 * L'outbox. Les événements ne sont jamais modifiés ; ils sont purgés au bout
 * de leur durée de conservation.
 */
export class PlatformEventRepository {
  async append(type: string, payload: Record<string, unknown>, executor: EventExecutor = db): Promise<number> {
    const [row] = await executor.insert(platform_events).values({ type, payload }).returning({ id: platform_events.id });
    return row.id;
  }

  /** Les événements d'un type écrits après `afterId`, dans l'ordre. */
  async findAfter(type: string, afterId: number, limit: number): Promise<StoredPlatformEvent[]> {
    const rows = await db
      .select()
      .from(platform_events)
      .where(and(eq(platform_events.type, type), gt(platform_events.id, afterId)))
      .orderBy(asc(platform_events.id))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: (row.payload as Record<string, unknown> | null) ?? {},
      occurred_at: row.occurred_at,
    }));
  }

  async purgeOlderThan(cutoff: Date): Promise<number> {
    const rows = await db
      .delete(platform_events)
      .where(lt(platform_events.occurred_at, cutoff))
      .returning({ id: platform_events.id });
    return rows.length;
  }
}
