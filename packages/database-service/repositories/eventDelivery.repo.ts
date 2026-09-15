import { db, event_deliveries } from "../db/drizzle";
import { eq, sql } from "drizzle-orm";

export interface EventDelivery {
  subscriber_key: string;
  last_event_id: number;
  last_error: string | null;
  updated_at: Date;
}

/**
 * EventDeliveryRepository
 * -----------------------
 * Le curseur de chaque abonné de l'outbox. Il ne recule jamais : deux
 * distributions concurrentes ne peuvent pas le ramener en arrière.
 */
export class EventDeliveryRepository {
  async find(subscriberKey: string): Promise<EventDelivery | null> {
    const [row] = await db.select().from(event_deliveries).where(eq(event_deliveries.subscriber_key, subscriberKey));
    return row ? { ...row, last_error: row.last_error ?? null } : null;
  }

  async findAll(): Promise<EventDelivery[]> {
    const rows = await db.select().from(event_deliveries);
    return rows.map((row) => ({ ...row, last_error: row.last_error ?? null }));
  }

  /** Avance le curseur et note la dernière erreur (`null` quand la file s'est vidée sans erreur). */
  async advance(subscriberKey: string, lastEventId: number, error: string | null): Promise<void> {
    await db
      .insert(event_deliveries)
      .values({ subscriber_key: subscriberKey, last_event_id: lastEventId, last_error: error, updated_at: new Date() })
      .onConflictDoUpdate({
        target: event_deliveries.subscriber_key,
        set: {
          last_event_id: sql`GREATEST(${event_deliveries.last_event_id}, ${lastEventId})`,
          last_error: error,
          updated_at: new Date(),
        },
      });
  }
}
