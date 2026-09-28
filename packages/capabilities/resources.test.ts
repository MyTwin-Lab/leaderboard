import { describe, it, expect, beforeEach } from "vitest";
import {
  ClaimNotConsumableError,
  claimState,
  resources,
  type DrawTransaction,
  type ResourceClaim,
  type ResourceInstance,
  type ResourceStore,
} from "./resources.js";

/**
 * Un store en mémoire qui reproduit ce que Postgres garantit au tirage : un
 * verrou de ligne pris par `FOR UPDATE SKIP LOCKED` (un autre tirage saute la
 * ligne au lieu d'attendre), l'index unique partiel sur les réclamations
 * vivantes et l'échéance lue à l'heure courante. Chaque opération rend la main
 * à la boucle d'événements, pour que des tirages concurrents s'entrelacent.
 *
 * Il éprouve l'algorithme de la capacité, pas le SQL du repository : aucun
 * test du dépôt ne tourne contre un vrai Postgres.
 */
class MemoryStore {
  now = new Date("2026-09-16T12:00:00Z");
  instances: ResourceInstance[] = [];
  claims: ResourceClaim[] = [];
  private locks = new Map<string, number>();
  private nextTx = 1;
  private seq = 0;

  private tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  private id = (prefix: string) => `${prefix}-${++this.seq}`;

  add(type: string, count: number, cls: string | null = null): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const uuid = this.id(type);
      this.instances.push({
        uuid, challenge_id: "c1", resource_type: type, payload: { n: i }, class: cls, state: "open",
        verdict: null, resolution: null, created_by: null, created_at: new Date(this.now.getTime() + this.seq), closed_at: null,
      });
      ids.push(uuid);
    }
    return ids;
  }

  private isActive = (c: ResourceClaim) =>
    !c.consumed_at && !c.released_at && (!c.expires_at || c.expires_at.getTime() > this.now.getTime());
  private countsTowardK = (c: ResourceClaim) => !!c.consumed_at || this.isActive(c);
  towardK = (resourceId: string) => this.claims.filter((c) => c.resource_id === resourceId && this.countsTowardK(c)).length;

  store(): ResourceStore {
    const self = this;
    const tx = (txId: number): DrawTransaction => ({
      async releaseExpired(challengeId, userId) {
        await self.tick();
        for (const c of self.claims) {
          if (c.challenge_id === challengeId && c.user_id === userId && !c.consumed_at && !c.released_at
            && c.expires_at && c.expires_at.getTime() < self.now.getTime()) {
            c.released_at = c.expires_at;
          }
        }
      },
      async nextCandidate(q) {
        // Le filtre se lit sur l'instantané de la requête ; le verrou se prend
        // après. Entre les deux, une autre transaction peut valider sa
        // réclamation : c'est pourquoi la capacité recompte sous le verrou.
        const snapshot = self.instances.filter((r) =>
          r.challenge_id === q.challengeId && r.resource_type === q.type && r.state === "open"
          && (q.class === undefined || r.class === q.class)
          && !q.excluded.includes(r.uuid)
          && !self.claims.some((c) => c.resource_id === r.uuid && c.user_id === q.userId && !c.released_at)
          && (q.k === undefined || self.towardK(r.uuid) < q.k));
        await self.tick();
        const everClaimed = (r: ResourceInstance) => self.claims.some((c) => c.resource_id === r.uuid && c.user_id === q.userId);
        snapshot.sort((a, b) => Number(everClaimed(a)) - Number(everClaimed(b)));
        const candidate = snapshot.find((r) => !self.locks.has(r.uuid) || self.locks.get(r.uuid) === txId);
        if (!candidate) return null;
        self.locks.set(candidate.uuid, txId);
        return { uuid: candidate.uuid, payload: candidate.payload };
      },
      async countTowardK(resourceId) {
        await self.tick();
        return self.towardK(resourceId);
      },
      async insertClaim(claim) {
        await self.tick();
        if (self.claims.some((c) => c.resource_id === claim.resourceId && c.user_id === claim.userId && !c.released_at)) {
          return null;
        }
        const row: ResourceClaim = {
          uuid: self.id("claim"), resource_id: claim.resourceId, challenge_id: claim.challengeId, user_id: claim.userId,
          result: null, claimed_at: self.now, consumed_at: null, released_at: null,
          expires_at: claim.ttlHours === undefined ? null : new Date(self.now.getTime() + claim.ttlHours * 3600_000),
        };
        self.claims.push(row);
        return row;
      },
    });

    return {
      async inDrawTransaction(run) {
        const txId = self.nextTx++;
        try {
          return await run(tx(txId));
        } finally {
          for (const [resourceId, holder] of self.locks) if (holder === txId) self.locks.delete(resourceId);
        }
      },
      async consume(claimId, userId, result) {
        const c = self.claims.find((x) => x.uuid === claimId && x.user_id === userId && self.isActive(x));
        if (!c) return null;
        c.result = result;
        c.consumed_at = self.now;
        return c;
      },
      async release(claimId, userId) {
        const c = self.claims.find((x) => x.uuid === claimId && x.user_id === userId && self.isActive(x));
        if (!c) return false;
        c.released_at = self.now;
        return true;
      },
      async findClaim(claimId) {
        return self.claims.find((c) => c.uuid === claimId) ?? null;
      },
    } as unknown as ResourceStore;
  }
}

let mem: MemoryStore;
let api: ReturnType<typeof resources>;

beforeEach(() => {
  mem = new MemoryStore();
  api = resources(mem.store());
});

const hours = (n: number) => n * 3600_000;

describe("resources.draw — k-bounded", () => {
  it("never lets concurrent draws exceed k on a single resource", async () => {
    const [item] = mem.add("item", 1);
    const users = Array.from({ length: 12 }, (_, i) => `u${i}`);

    // Plusieurs vagues : un tirage qui a sauté la ligne verrouillée retente
    // à la vague suivante, comme un annotateur qui retire.
    for (let wave = 0; wave < 6; wave++) {
      await Promise.all(users.map((u) => api.draw("c1", u, { type: "item", k: 3, ttlHours: 48 })));
      expect(mem.towardK(item)).toBeLessThanOrEqual(3);
    }
    expect(mem.towardK(item)).toBe(3);
  });

  it("recounts under the lock: a snapshot taken before a concurrent commit cannot overfill", async () => {
    const [item] = mem.add("item", 1);
    const users = Array.from({ length: 12 }, (_, i) => `u${i}`);
    const pause = (ticks: number) => (async () => { for (let i = 0; i < ticks; i++) await new Promise((r) => setTimeout(r, 0)); })();

    // Départs décalés : un tirage lit son instantané pendant qu'un autre tient
    // le verrou, puis prend la ligne juste après sa validation.
    for (let wave = 0; wave < 4; wave++) {
      await Promise.all(users.map(async (u, i) => {
        await pause(i % 5);
        await api.draw("c1", u, { type: "item", k: 2, ttlHours: 48 });
      }));
      expect(mem.towardK(item)).toBeLessThanOrEqual(2);
    }
  });

  it("spreads concurrent draws across resources instead of colliding", async () => {
    mem.add("item", 4);
    const drawn = await Promise.all(["a", "b", "c", "d"].map((u) => api.draw("c1", u, { type: "item", k: 1 })));

    const ids = drawn.map((d) => d?.resourceId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of mem.instances) expect(mem.towardK(r.uuid)).toBeLessThanOrEqual(1);
  });

  it("returns null once every resource is full", async () => {
    mem.add("item", 1);
    expect(await api.draw("c1", "a", { type: "item", k: 1 })).not.toBeNull();
    expect(await api.draw("c1", "b", { type: "item", k: 1 })).toBeNull();
  });

  it("refuses a non-positive k", async () => {
    await expect(api.draw("c1", "a", { type: "item", k: 0 })).rejects.toThrow(/k must be/);
  });
});

describe("resources.draw — TTL", () => {
  it("frees the slot of an expired claim", async () => {
    mem.add("item", 1);
    await api.draw("c1", "a", { type: "item", k: 1, ttlHours: 1 });
    expect(await api.draw("c1", "b", { type: "item", k: 1, ttlHours: 1 })).toBeNull();

    mem.now = new Date(mem.now.getTime() + hours(2));
    expect(await api.draw("c1", "b", { type: "item", k: 1, ttlHours: 1 })).not.toBeNull();
  });

  it("frees the unique hold of its own author once expired", async () => {
    const [item] = mem.add("item", 1);
    await api.draw("c1", "a", { type: "item", k: 3, ttlHours: 1 });
    expect(await api.draw("c1", "a", { type: "item", k: 3, ttlHours: 1 })).toBeNull();

    mem.now = new Date(mem.now.getTime() + hours(2));
    const again = await api.draw("c1", "a", { type: "item", k: 3, ttlHours: 1 });

    expect(again?.resourceId).toBe(item);
    // L'ancienne réclamation est libérée à son échéance, pas effacée.
    expect(mem.claims.filter((c) => c.user_id === "a").map((c) => c.released_at)).toEqual([
      new Date("2026-09-16T13:00:00Z"),
      null,
    ]);
  });

  it("keeps a consumed claim counting and holding, whatever its expiry", async () => {
    mem.add("item", 1);
    const drawn = await api.draw("c1", "a", { type: "item", k: 1, ttlHours: 1 });
    await api.consume(drawn!.claimId, "a", { value: "x" });

    mem.now = new Date(mem.now.getTime() + hours(5));
    expect(await api.draw("c1", "b", { type: "item", k: 1, ttlHours: 1 })).toBeNull();
    expect(await api.draw("c1", "a", { type: "item", k: 5, ttlHours: 1 })).toBeNull();
  });
});

describe("resources.draw — unique per person", () => {
  it("never serves the same resource twice to the same person", async () => {
    mem.add("gold", 2);
    const first = await api.draw("c1", "a", { type: "gold" });
    await api.consume(first!.claimId, "a", { value: "x" });
    const second = await api.draw("c1", "a", { type: "gold" });
    await api.consume(second!.claimId, "a", { value: "y" });

    expect(second?.resourceId).not.toBe(first?.resourceId);
    expect(await api.draw("c1", "a", { type: "gold" })).toBeNull();
  });

  it("without k, serves the same resource to everyone", async () => {
    const [gold] = mem.add("gold", 1);
    const drawn = await Promise.all(Array.from({ length: 8 }, (_, i) => api.draw("c1", `u${i}`, { type: "gold" })));
    // Les tirages qui ont sauté la ligne verrouillée la retrouvent ensuite.
    const retried = await Promise.all(
      drawn.map((d, i) => (d ? d : api.draw("c1", `u${i}`, { type: "gold" })))
    );
    for (const d of retried) if (d) expect(d.resourceId).toBe(gold);
    expect(mem.claims.filter((c) => c.resource_id === gold).length).toBeGreaterThan(1);
  });

  it("lets a released resource be drawn again by its author, once the others are exhausted", async () => {
    const [first, second] = mem.add("item", 2);
    const drawn = await api.draw("c1", "a", { type: "item", k: 1 });
    expect(drawn?.resourceId).toBe(first);
    expect(await api.release(drawn!.claimId, "a")).toBe(true);

    // Passer une ressource sert la suivante, pas la même.
    const next = await api.draw("c1", "a", { type: "item", k: 1 });
    expect(next?.resourceId).toBe(second);
    await api.consume(next!.claimId, "a", { value: "x" });

    expect((await api.draw("c1", "a", { type: "item", k: 1 }))?.resourceId).toBe(first);
  });
});

describe("resources.draw — class", () => {
  it("only draws resources of the requested class", async () => {
    mem.add("item", 1, "sensitive");
    const [standard] = mem.add("item", 1, "standard");
    expect((await api.draw("c1", "a", { type: "item", k: 1, class: "standard" }))?.resourceId).toBe(standard);
    expect(await api.draw("c1", "b", { type: "item", k: 1, class: "standard" })).toBeNull();
  });
});

describe("resources.consume", () => {
  it("refuses a lapsed claim: a late label would exceed k", async () => {
    mem.add("item", 1);
    const drawn = await api.draw("c1", "a", { type: "item", k: 1, ttlHours: 1 });
    mem.now = new Date(mem.now.getTime() + hours(2));

    await expect(api.consume(drawn!.claimId, "a", { value: "x" })).rejects.toMatchObject({ reason: "lapsed" });
  });

  it("refuses a second consumption, and anyone else's claim", async () => {
    mem.add("item", 1);
    const drawn = await api.draw("c1", "a", { type: "item", k: 1 });
    await api.consume(drawn!.claimId, "a", { value: "x" });

    await expect(api.consume(drawn!.claimId, "a", { value: "y" })).rejects.toMatchObject({ reason: "consumed" });
    await expect(api.consume(drawn!.claimId, "b", { value: "y" })).rejects.toBeInstanceOf(ClaimNotConsumableError);
    await expect(api.consume(drawn!.claimId, "b", { value: "y" })).rejects.toMatchObject({ reason: "not_found" });
  });
});

describe("claimState", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  it.each([
    [{ consumed_at: now, released_at: null, expires_at: new Date(0) }, "consumed"],
    [{ consumed_at: null, released_at: now, expires_at: null }, "lapsed"],
    [{ consumed_at: null, released_at: null, expires_at: new Date(now.getTime() - 1) }, "lapsed"],
    [{ consumed_at: null, released_at: null, expires_at: new Date(now.getTime() + 1) }, "active"],
    [{ consumed_at: null, released_at: null, expires_at: null }, "active"],
  ])("%o is %s", (claim, state) => {
    expect(claimState(claim, now)).toBe(state);
  });
});
