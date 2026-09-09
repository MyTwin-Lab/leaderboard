import { describe, it, expect, vi } from "vitest";
import {
  SandboxForbiddenError,
  SandboxNotOpenError,
  SandboxService,
  SelfStarError,
  StarRateLimitedError,
  type SandboxServiceDeps,
} from "./sandbox.service.js";
import { planAnonAttach } from "./starAttach.js";
import type {
  Sandbox,
  SandboxReward,
  SandboxStar,
  SandboxStarTier,
} from "../../database-service/domain/entities.js";

const SANDBOX_ID = "sb-1";
const AUTHOR = "author-1";
const NOW = new Date("2026-09-09T12:00:00.000Z");

const TIERS: SandboxStarTier[] = [
  { stars: 5, cp: 50 },
  { stars: 15, cp: 100 },
  { stars: 30, cp: 200 },
];

function makeSandbox(over: Partial<Sandbox> = {}): Sandbox {
  return {
    uuid: SANDBOX_ID,
    user_id: AUTHOR,
    type: "code",
    title: "Triage assistant",
    context: null,
    goals: [],
    why: null,
    repo_url: "https://github.com/org/repo",
    model_url: null,
    dataset_urls: [],
    status: "open",
    promoted_challenge_id: null,
    promoted_at: null,
    evaluation_status: null,
    evaluated_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}

/**
 * Doublures en mémoire plutôt que de simples `vi.fn()` de retour constant :
 * l'idempotence du service repose entièrement sur le comportement réel de
 * l'upsert (une ligne par identité) et d'`insertTierIfAbsent` (null si déjà
 * payé). Une doublure sans état ne prouverait rien de ces deux invariants.
 */
function makeDeps(
  opts: {
    sandbox?: Partial<Sandbox> | null;
    tiers?: SandboxStarTier[];
    /** Ce que renvoie `countCreatedByIpSince` — la fenêtre de débit. */
    ipCount?: number;
    /** Stars anonymes déjà en place avant l'appel testé. */
    seedAnonStars?: number;
  } = {}
) {
  const stars: SandboxStar[] = [];
  const rewards: SandboxReward[] = [];

  for (let i = 0; i < (opts.seedAnonStars ?? 0); i++) {
    stars.push({
      uuid: `seed-${i}`,
      sandbox_id: SANDBOX_ID,
      user_id: null,
      anon_id: `seed-anon-${i}`,
      origin: "anonymous",
      ip_hash: null,
      created_at: NOW,
      removed_at: null,
      attached_at: null,
    });
  }

  const sandboxRepo = {
    findById: vi.fn(async () => (opts.sandbox === null ? null : makeSandbox(opts.sandbox))),
    create: vi.fn(async () => makeSandbox()),
    update: vi.fn(async (_uuid: string, patch: Record<string, unknown>) =>
      makeSandbox(patch as Partial<Sandbox>)
    ),
    archive: vi.fn(async () => makeSandbox({ status: "archived" })),
  };

  function findRow(predicate: (row: SandboxStar) => boolean): SandboxStar | undefined {
    return stars.find(predicate);
  }

  const starRepo = {
    upsertUserStar: vi.fn(async (entry: { sandbox_id: string; user_id: string; ip_hash?: string | null }) => {
      const existing = findRow((r) => r.sandbox_id === entry.sandbox_id && r.user_id === entry.user_id);
      if (existing) {
        existing.removed_at = null;
        return existing;
      }
      const row: SandboxStar = {
        uuid: `star-${stars.length}`,
        sandbox_id: entry.sandbox_id,
        user_id: entry.user_id,
        anon_id: null,
        origin: "account",
        ip_hash: entry.ip_hash ?? null,
        created_at: NOW,
        removed_at: null,
        attached_at: null,
      };
      stars.push(row);
      return row;
    }),
    upsertAnonStar: vi.fn(async (entry: { sandbox_id: string; anon_id: string; ip_hash?: string | null }) => {
      const existing = findRow(
        (r) => r.sandbox_id === entry.sandbox_id && r.anon_id === entry.anon_id && r.user_id === null
      );
      if (existing) {
        existing.removed_at = null;
        return existing;
      }
      const row: SandboxStar = {
        uuid: `star-${stars.length}`,
        sandbox_id: entry.sandbox_id,
        user_id: null,
        anon_id: entry.anon_id,
        origin: "anonymous",
        ip_hash: entry.ip_hash ?? null,
        created_at: NOW,
        removed_at: null,
        attached_at: null,
      };
      stars.push(row);
      return row;
    }),
    softRemove: vi.fn(async (uuid: string) => {
      const row = findRow((r) => r.uuid === uuid && r.removed_at === null);
      if (!row) return false;
      row.removed_at = NOW;
      return true;
    }),
    findActiveForUser: vi.fn(
      async (sandboxId: string, userId: string) =>
        findRow((r) => r.sandbox_id === sandboxId && r.user_id === userId && r.removed_at === null) ?? null
    ),
    findActiveForAnon: vi.fn(
      async (sandboxId: string, anonId: string) =>
        findRow(
          (r) =>
            r.sandbox_id === sandboxId &&
            r.anon_id === anonId &&
            r.user_id === null &&
            r.removed_at === null
        ) ?? null
    ),
    countActive: vi.fn(
      async (sandboxId: string) =>
        stars.filter((r) => r.sandbox_id === sandboxId && r.removed_at === null).length
    ),
    countCreatedByIpSince: vi.fn(async () => opts.ipCount ?? 0),
    attachAnonToUser: vi.fn(async () => ({ deleted: 0, attached: 0 })),
    purgeIpHashesOlderThan: vi.fn(async (_cutoff: Date) => 0),
  };

  const rewardRepo = {
    paidTierThresholdsBySandboxIds: vi.fn(async (ids: string[]) => {
      const map = new Map<string, number[]>();
      for (const id of ids) {
        const thresholds = rewards
          .filter((r) => r.sandbox_id === id && r.rule_key === "star_tier" && r.tier_stars !== null)
          .map((r) => r.tier_stars as number)
          .sort((a, b) => a - b);
        if (thresholds.length > 0) map.set(id, thresholds);
      }
      return map;
    }),
    insertTierIfAbsent: vi.fn(
      async (entry: { sandbox_id: string; user_id: string; tier_stars: number; points: number }) => {
        const already = rewards.some(
          (r) =>
            r.sandbox_id === entry.sandbox_id &&
            r.rule_key === "star_tier" &&
            r.tier_stars === entry.tier_stars
        );
        // `null` = un autre appel a écrit la ligne : c'est le signal
        // d'idempotence, pas une erreur.
        if (already) return null;
        const row: SandboxReward = {
          uuid: `rw-${rewards.length}`,
          sandbox_id: entry.sandbox_id,
          user_id: entry.user_id,
          rule_key: "star_tier",
          tier_stars: entry.tier_stars,
          points: entry.points,
          created_at: NOW,
        };
        rewards.push(row);
        return row;
      }
    ),
  };

  const appSettingsRepo = {
    get: vi.fn(async () => ({ sandbox_star_tiers: opts.tiers ?? TIERS })),
  };

  const deps: SandboxServiceDeps = {
    sandboxRepo,
    starRepo,
    rewardRepo,
    appSettingsRepo,
    now: () => NOW,
  };

  return { deps, stars, rewards, sandboxRepo, starRepo, rewardRepo, appSettingsRepo };
}

describe("SandboxService.star", () => {
  it("refuse l'auteur sur son propre sandbox", async () => {
    const { deps, starRepo } = makeDeps();
    const service = new SandboxService(deps);

    await expect(service.star(SANDBOX_ID, { kind: "account", userId: AUTHOR })).rejects.toBeInstanceOf(
      SelfStarError
    );
    // Refus avant toute écriture.
    expect(starRepo.upsertUserStar).not.toHaveBeenCalled();
  });

  it("refuse un sandbox qui n'est plus open", async () => {
    const { deps, starRepo } = makeDeps({ sandbox: { status: "promoted" } });
    const service = new SandboxService(deps);

    await expect(service.star(SANDBOX_ID, { kind: "account", userId: "bob" })).rejects.toBeInstanceOf(
      SandboxNotOpenError
    );
    expect(starRepo.upsertUserStar).not.toHaveBeenCalled();
  });

  it("est idempotent : deux stars de la même identité ne font qu'une ligne et un paiement", async () => {
    const { deps, stars, rewards } = makeDeps({ tiers: [{ stars: 1, cp: 10 }] });
    const service = new SandboxService(deps);

    const first = await service.star(SANDBOX_ID, { kind: "account", userId: "bob" });
    const second = await service.star(SANDBOX_ID, { kind: "account", userId: "bob" });

    expect(first).toEqual({ starCount: 1, myStar: true, paidTierThresholds: [1] });
    expect(second).toEqual({ starCount: 1, myStar: true, paidTierThresholds: [1] });
    expect(stars).toHaveLength(1);
    expect(rewards).toHaveLength(1);
  });

  it("star → unstar → star ne paie qu'une fois", async () => {
    const { deps, rewards } = makeDeps({ tiers: [{ stars: 1, cp: 10 }] });
    const service = new SandboxService(deps);
    const bob = { kind: "account", userId: "bob" } as const;

    await service.star(SANDBOX_ID, bob);
    const removed = await service.unstar(SANDBOX_ID, bob);
    const again = await service.star(SANDBOX_ID, bob);

    // Le compteur redescend, le palier reste payé : rien n'est repris.
    expect(removed).toEqual({ starCount: 0, myStar: false, paidTierThresholds: [1] });
    expect(again).toEqual({ starCount: 1, myStar: true, paidTierThresholds: [1] });
    expect(rewards).toHaveLength(1);
    expect(rewards.map((r) => r.points)).toEqual([10]);
  });

  it("paie les paliers 5 et 15 d'un coup quand le compteur saute à 15", async () => {
    const { deps, rewards, rewardRepo } = makeDeps({ seedAnonStars: 14 });
    const service = new SandboxService(deps);

    const state = await service.star(SANDBOX_ID, { kind: "account", userId: "bob" });

    expect(state.starCount).toBe(15);
    expect(state.paidTierThresholds).toEqual([5, 15]);
    expect(rewards.map((r) => r.tier_stars)).toEqual([5, 15]);
    expect(rewards.map((r) => r.points)).toEqual([50, 100]);
    // Le palier 30 n'est pas atteint.
    expect(rewardRepo.insertTierIfAbsent).toHaveBeenCalledTimes(2);
    // Auteur au moment du paiement, dénormalisé.
    expect(rewards.every((r) => r.user_id === AUTHOR)).toBe(true);
  });

  it("applique le rate-limit aux stars anonymes", async () => {
    const { deps, starRepo } = makeDeps({ ipCount: 30 });
    const service = new SandboxService(deps);

    await expect(
      service.star(SANDBOX_ID, { kind: "anonymous", anonId: "anon-1" }, "ip-hash")
    ).rejects.toBeInstanceOf(StarRateLimitedError);
    expect(starRepo.upsertAnonStar).not.toHaveBeenCalled();
  });

  it("n'applique pas le rate-limit aux stars de compte", async () => {
    const { deps, starRepo } = makeDeps({ ipCount: 30 });
    const service = new SandboxService(deps);

    const state = await service.star(SANDBOX_ID, { kind: "account", userId: "bob" }, "ip-hash");

    expect(state.starCount).toBe(1);
    // L'index unique borne déjà un compte : on ne compte même pas la fenêtre.
    expect(starRepo.countCreatedByIpSince).not.toHaveBeenCalled();
  });

  it("déclenche la purge opportuniste des hachés d'IP", async () => {
    const { deps, starRepo } = makeDeps();
    const service = new SandboxService(deps);

    await service.star(SANDBOX_ID, { kind: "account", userId: "bob" }, "ip-hash");

    expect(starRepo.purgeIpHashesOlderThan).toHaveBeenCalledTimes(1);
    const cutoff = starRepo.purgeIpHashesOlderThan.mock.calls[0][0];
    expect(cutoff.toISOString()).toBe("2026-08-10T12:00:00.000Z");
  });

  it("ne fait pas échouer la star si la purge échoue", async () => {
    const { deps, starRepo } = makeDeps();
    starRepo.purgeIpHashesOlderThan.mockRejectedValueOnce(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const service = new SandboxService(deps);

    await expect(service.star(SANDBOX_ID, { kind: "account", userId: "bob" })).resolves.toMatchObject({
      starCount: 1,
    });
    warn.mockRestore();
  });
});

describe("SandboxService.unstar", () => {
  it("est idempotent sur une identité qui n'a pas staré", async () => {
    const { deps, starRepo } = makeDeps();
    const service = new SandboxService(deps);

    const state = await service.unstar(SANDBOX_ID, { kind: "anonymous", anonId: "anon-1" });

    expect(state).toEqual({ starCount: 0, myStar: false, paidTierThresholds: [] });
    expect(starRepo.softRemove).not.toHaveBeenCalled();
  });
});

describe("SandboxService.attachAnonStars", () => {
  it("passe la fonction pure planAnonAttach à la transaction du repository", async () => {
    const { deps, starRepo } = makeDeps();
    const service = new SandboxService(deps);

    await service.attachAnonStars("anon-1", "bob");

    expect(starRepo.attachAnonToUser).toHaveBeenCalledWith("anon-1", "bob", planAnonAttach);
  });
});

describe("SandboxService.update", () => {
  it("refuse un sandbox promu", async () => {
    const { deps, sandboxRepo } = makeDeps({ sandbox: { status: "promoted" } });
    const service = new SandboxService(deps);

    await expect(service.update(SANDBOX_ID, AUTHOR, { title: "x" })).rejects.toBeInstanceOf(
      SandboxNotOpenError
    );
    expect(sandboxRepo.update).not.toHaveBeenCalled();
  });

  it("refuse un sandbox archivé", async () => {
    const { deps } = makeDeps({ sandbox: { status: "archived" } });
    const service = new SandboxService(deps);

    await expect(service.update(SANDBOX_ID, AUTHOR, { title: "x" })).rejects.toBeInstanceOf(
      SandboxNotOpenError
    );
  });

  it("refuse un autre que l'auteur", async () => {
    const { deps, sandboxRepo } = makeDeps();
    const service = new SandboxService(deps);

    await expect(service.update(SANDBOX_ID, "bob", { title: "x" })).rejects.toBeInstanceOf(
      SandboxForbiddenError
    );
    expect(sandboxRepo.update).not.toHaveBeenCalled();
  });

  it("accepte l'auteur sur un sandbox open", async () => {
    const { deps, sandboxRepo } = makeDeps();
    const service = new SandboxService(deps);

    const updated = await service.update(SANDBOX_ID, AUTHOR, { title: "Nouveau titre" });

    expect(updated.title).toBe("Nouveau titre");
    expect(sandboxRepo.update).toHaveBeenCalledWith(SANDBOX_ID, { title: "Nouveau titre" });
  });
});

describe("SandboxService.archive", () => {
  it("laisse l'auteur archiver le sien", async () => {
    const { deps, sandboxRepo } = makeDeps();
    const service = new SandboxService(deps);

    await service.archive(SANDBOX_ID, { userId: AUTHOR, isAdmin: false });

    expect(sandboxRepo.archive).toHaveBeenCalledWith(SANDBOX_ID);
  });

  it("laisse un admin archiver n'importe lequel", async () => {
    const { deps, sandboxRepo } = makeDeps();
    const service = new SandboxService(deps);

    await service.archive(SANDBOX_ID, { userId: "admin-1", isAdmin: true });

    expect(sandboxRepo.archive).toHaveBeenCalledWith(SANDBOX_ID);
  });

  it("refuse un tiers — un manager n'a aucun droit particulier sur un sandbox", async () => {
    const { deps, sandboxRepo } = makeDeps();
    const service = new SandboxService(deps);

    await expect(
      service.archive(SANDBOX_ID, { userId: "manager-1", isAdmin: false })
    ).rejects.toBeInstanceOf(SandboxForbiddenError);
    expect(sandboxRepo.archive).not.toHaveBeenCalled();
  });
});
