import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { StoredPlatformEvent } from "../database-service/repositories/platformEvent.repo.js";
import { PlatformRegistry, type PlatformEvent } from "../registry/platform.js";
import { createEvents, EVENT_RETENTION_DAYS, type DeliveryStore, type EventStore } from "./events.js";

const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });

function memoryEvents(): EventStore & { rows: StoredPlatformEvent[]; purgedBefore: Date[] } {
  const rows: StoredPlatformEvent[] = [];
  const purgedBefore: Date[] = [];
  return {
    rows,
    purgedBefore,
    append: async (type, payload) => {
      const row = { id: rows.length + 1, type, payload, occurred_at: new Date() };
      rows.push(row);
      return row.id;
    },
    findAfter: async (type, afterId, limit) => rows.filter((r) => r.type === type && r.id > afterId).slice(0, limit),
    purgeOlderThan: async (cutoff) => {
      purgedBefore.push(cutoff);
      return 0;
    },
  };
}

function memoryDeliveries(): DeliveryStore & { cursors: Map<string, { last_event_id: number; last_error: string | null }> } {
  const cursors = new Map<string, { last_event_id: number; last_error: string | null }>();
  return {
    cursors,
    find: async (key) => {
      const row = cursors.get(key);
      return row ? { subscriber_key: key, ...row, updated_at: new Date() } : null;
    },
    advance: async (key, lastEventId, error) => {
      cursors.set(key, { last_event_id: Math.max(cursors.get(key)?.last_event_id ?? 0, lastEventId), last_error: error });
    },
  };
}

const quests: PlatformEvent[] = [];
const failingOn = { id: -1 };

beforeEach(() => {
  quests.length = 0;
  failingOn.id = -1;
  PlatformRegistry.reset();
  PlatformRegistry.install({
    flows: [{ descriptor: descriptor("code"), events: [{ type: "evaluation.requested" }] }],
    modules: [
      {
        key: "onboarding",
        events: [{ type: "task.archived" }],
        subscriptions: [
          {
            key: "onboarding.assigned-task",
            event: "task.archived",
            async handle(event) {
              if (event.id === failingOn.id) throw new Error("quest store down");
              quests.push(event);
            },
          },
        ],
      },
    ],
  });
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("events.emit", () => {
  it("writes an event that has a subscriber, inside the given executor", async () => {
    const store = memoryEvents();
    const append = vi.spyOn(store, "append");
    const executor = { insert: vi.fn() } as never;
    const events = createEvents({ events: store, deliveries: memoryDeliveries() });

    expect(await events.emit("task.archived", { taskId: "t-1" }, { executor })).toBe(1);
    expect(append).toHaveBeenCalledWith("task.archived", { taskId: "t-1" }, executor);
  });

  it("writes nothing for an event nobody subscribes to", async () => {
    const store = memoryEvents();
    const events = createEvents({ events: store, deliveries: memoryDeliveries() });

    expect(await events.emit("evaluation.requested", { challengeId: "c-1" })).toBeNull();
    expect(await events.emit("never.declared")).toBeNull();
    expect(store.rows).toEqual([]);
  });
});

describe("events.distribute", () => {
  it("delivers the events of a subscriber's type in order, and moves its cursor", async () => {
    const store = memoryEvents();
    const deliveries = memoryDeliveries();
    const events = createEvents({ events: store, deliveries, isOwnerEnabled: async () => true });
    await store.append("task.archived", { taskId: "t-1" });
    await store.append("evaluation.requested", {});
    await store.append("task.archived", { taskId: "t-2" });

    const summary = await events.distribute();

    expect(quests.map((e) => e.payload.taskId)).toEqual(["t-1", "t-2"]);
    expect(summary).toEqual([{ key: "onboarding.assigned-task", owner: "module:onboarding", event: "task.archived", delivered: 2 }]);
    expect(deliveries.cursors.get("onboarding.assigned-task")).toEqual({ last_event_id: 3, last_error: null });

    await events.distribute();
    expect(quests).toHaveLength(2);
  });

  it("stops a subscriber's queue on an error, keeping its cursor on the last success", async () => {
    const store = memoryEvents();
    const deliveries = memoryDeliveries();
    const events = createEvents({ events: store, deliveries, isOwnerEnabled: async () => true });
    await store.append("task.archived", { taskId: "t-1" });
    await store.append("task.archived", { taskId: "t-2" });
    failingOn.id = 2;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const [summary] = await events.distribute();

    expect(summary).toMatchObject({ delivered: 1, error: "quest store down" });
    expect(deliveries.cursors.get("onboarding.assigned-task")).toEqual({ last_event_id: 1, last_error: "quest store down" });

    failingOn.id = -1;
    await events.distribute();
    expect(quests.map((e) => e.payload.taskId)).toEqual(["t-1", "t-2"]);
    spy.mockRestore();
  });

  it("leaves the queue of a disabled module untouched", async () => {
    const store = memoryEvents();
    const deliveries = memoryDeliveries();
    const events = createEvents({ events: store, deliveries, isOwnerEnabled: async (owner) => owner !== "module:onboarding" });
    await store.append("task.archived", { taskId: "t-1" });

    expect(await events.distribute()).toEqual([
      { key: "onboarding.assigned-task", owner: "module:onboarding", event: "task.archived", delivered: 0, skipped: "owner_disabled" },
    ]);
    expect(quests).toEqual([]);
    expect(deliveries.cursors.size).toBe(0);
  });
});

describe("events.purge", () => {
  it("purges what is older than the retention", async () => {
    const store = memoryEvents();
    const now = new Date("2026-09-15T05:30:00Z");
    const events = createEvents({ events: store, deliveries: memoryDeliveries(), clock: () => now });

    await events.purge();

    expect(store.purgedBefore[0].getTime()).toBe(now.getTime() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  });
});
