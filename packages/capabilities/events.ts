import type { EventDelivery } from "../database-service/repositories/eventDelivery.repo.js";
import type { EventExecutor, StoredPlatformEvent } from "../database-service/repositories/platformEvent.repo.js";
import { PlatformRegistry, type JobDeclaration, type Owned } from "../registry/platform.js";
import { ownerEnabled } from "./modules.js";

/**
 * Capacité `events` — l'outbox
 * ----------------------------
 * Une action écrit son événement dans sa propre transaction (`emit`) ; le
 * tick le distribue ensuite à chaque abonné, dans l'ordre, par un curseur
 * propre à l'abonné (`event_deliveries`).
 *
 * Un événement n'existe que s'il a au moins un abonné : `emit` d'un type que
 * rien ne déclare n'écrit rien. Le core seul, sans module, n'émet donc rien.
 */

export interface EventStore {
  append(type: string, payload: Record<string, unknown>, executor?: EventExecutor): Promise<number>;
  findAfter(type: string, afterId: number, limit: number): Promise<StoredPlatformEvent[]>;
  purgeOlderThan(cutoff: Date): Promise<number>;
}

export interface DeliveryStore {
  find(subscriberKey: string): Promise<EventDelivery | null>;
  advance(subscriberKey: string, lastEventId: number, error: string | null): Promise<void>;
}

export interface SubscriberSummary {
  key: string;
  owner: string;
  event: string;
  delivered: number;
  skipped?: "owner_disabled";
  error?: string;
}

/** Les événements se gardent 30 jours : assez pour qu'un abonné arrêté rattrape sa file. */
export const EVENT_RETENTION_DAYS = 30;

export interface EventsDeps {
  events?: EventStore;
  deliveries?: DeliveryStore;
  isOwnerEnabled?: (owner: string) => Promise<boolean>;
  clock?: () => Date;
}

export interface Events {
  /** Écrit l'événement, dans la transaction donnée s'il y en a une. `null` : type sans abonné, rien d'écrit. */
  emit(type: string, payload?: Record<string, unknown>, options?: { executor?: EventExecutor }): Promise<number | null>;
  distribute(options?: { batchSize?: number }): Promise<SubscriberSummary[]>;
  purge(): Promise<number>;
}

export function createEvents(deps: EventsDeps = {}): Events {
  let eventStore = deps.events;
  let deliveryStore = deps.deliveries;
  const stores = async () => {
    if (!eventStore || !deliveryStore) {
      // Import à la demande : déclarer un émetteur ne charge pas la base.
      const repositories = await import("../database-service/repositories/index.js");
      eventStore ??= new repositories.PlatformEventRepository();
      deliveryStore ??= new repositories.EventDeliveryRepository();
    }
    return { events: eventStore!, deliveries: deliveryStore! };
  };
  const isOwnerEnabled = deps.isOwnerEnabled ?? ((owner: string) => ownerEnabled(owner));
  const clock = deps.clock ?? (() => new Date());

  return {
    async emit(type, payload = {}, options = {}) {
      if (!PlatformRegistry.isInstalled() || !PlatformRegistry.subscriptions().some((s) => s.event === type)) {
        return null;
      }
      return (await stores()).events.append(type, payload, options.executor);
    },

    async distribute({ batchSize = 100 } = {}) {
      if (!PlatformRegistry.isInstalled()) return [];
      const { events, deliveries } = await stores();
      const summaries: SubscriberSummary[] = [];

      for (const subscription of PlatformRegistry.subscriptions()) {
        const base = { key: subscription.key, owner: subscription.owner, event: subscription.event };
        if (!(await isOwnerEnabled(subscription.owner))) {
          // Un module désactivé ne consomme rien : sa file l'attend.
          summaries.push({ ...base, delivered: 0, skipped: "owner_disabled" });
          continue;
        }

        // Un nouvel abonné part du début de l'outbox, dont la conservation borne la reprise.
        let cursor = (await deliveries.find(subscription.key))?.last_event_id ?? 0;
        const batch = await events.findAfter(subscription.event, cursor, batchSize);
        let delivered = 0;
        let error: string | undefined;
        for (const event of batch) {
          try {
            await subscription.handle({ id: event.id, type: event.type, payload: event.payload, occurredAt: event.occurred_at });
            cursor = event.id;
            delivered++;
          } catch (cause) {
            error = cause instanceof Error ? cause.message : String(cause);
            console.error(`[events] Subscriber "${subscription.key}" failed on event ${event.id}:`, cause);
            break;
          }
        }
        if (delivered > 0 || error) await deliveries.advance(subscription.key, cursor, error ?? null);
        summaries.push({ ...base, delivered, ...(error ? { error } : {}) });
      }
      return summaries;
    },

    async purge() {
      const cutoff = new Date(clock().getTime() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      return (await stores()).events.purgeOlderThan(cutoff);
    },
  };
}

export const events: Events = createEvents();

/** Les jobs du core pour l'outbox : distribuer chaque minute, purger chaque jour. */
export const coreEventJobs: Owned<JobDeclaration>[] = [
  {
    key: "core.events.distribute",
    owner: "core",
    schedule: "* * * * *",
    run: () => events.distribute(),
  },
  {
    key: "core.events.purge",
    owner: "core",
    schedule: "30 5 * * *",
    async run() {
      return { deleted: await events.purge() };
    },
  },
];
