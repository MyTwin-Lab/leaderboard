import { describe, expect, it, vi } from "vitest";
import { DigestService, type DigestServiceDeps } from "./digest.service.js";
import type {
  Challenge, Contribution, Digest, RewardEntry, User,
} from "../../database-service/domain/entities.js";

const CH = "ch-1", ALICE = "alice", BOB = "bob";

function makeDeps(opts: {
  latest?: Digest | null;
  frequencyDays?: number;
  contributions?: Contribution[];
  challengesCreated?: Challenge[];
  challengesClosed?: Challenge[];
  contributors?: User[];
  rewardEntries?: RewardEntry[];
} = {}) {
  const created: Array<Parameters<DigestServiceDeps["digestRepo"]["create"]>[0]> = [];
  const memberLookups: string[][] = [];

  const deps: DigestServiceDeps = {
    digestRepo: {
      findLatest: vi.fn(async () => opts.latest ?? null),
      create: vi.fn(async (entry) => {
        created.push(entry);
        return { uuid: "d-1", generated_at: new Date(), ...entry } as Digest;
      }),
    },
    appSettingsRepo: {
      get: vi.fn(async () => ({ digest_frequency_days: opts.frequencyDays ?? 7 })),
    },
    contributionRepo: {
      findCreatedBetween: vi.fn(async () => opts.contributions ?? []),
    },
    contributionMemberRepo: {
      findByContributions: vi.fn(async (ids: string[]) => {
        memberLookups.push(ids);
        return [];
      }),
    },
    challengeRepo: {
      findCreatedBetween: vi.fn(async () => opts.challengesCreated ?? []),
      findClosedBetween: vi.fn(async () => opts.challengesClosed ?? []),
      findById: vi.fn(async (uuid: string) => ({
        uuid, title: "Build the API", status: "active", type: "code",
        contribution_points_reward: 1000, completion: 0, project_id: "p-1",
        created_at: new Date("2026-09-01T00:00:00Z"),
      } as Challenge)),
    },
    userRepo: {
      findCreatedBetween: vi.fn(async () => opts.contributors ?? []),
      findById: vi.fn(async (uuid: string) => ({
        uuid, full_name: `User ${uuid}`, role: "contributor",
        created_at: new Date("2026-01-01T00:00:00Z"),
      } as User)),
    },
    rewardEntryRepo: {
      findCreatedBetween: vi.fn(async () => opts.rewardEntries ?? []),
      sumByChallenge: vi.fn(async () => 840),
    },
    projectRepo: {
      findById: vi.fn(async (uuid: string) => ({
        uuid, title: "MyTwin Core", description: "", created_at: new Date(),
      } as any)),
    },
  };

  return { deps, created, memberLookups };
}

function digestAt(periodEnd: string): Digest {
  return {
    uuid: "d-0",
    period_start: new Date("2026-08-22T06:00:00Z"),
    period_end: new Date(periodEnd),
    generated_at: new Date(periodEnd),
    trigger_source: "cron",
    payload: { version: 1 } as Digest["payload"],
  };
}

describe("DigestService.generate", () => {
  it("starts the window at the previous digest's period_end", async () => {
    // L'invariant qui interdit trou et recouvrement entre deux digests.
    const { deps, created } = makeDeps({ latest: digestAt("2026-08-29T06:00:03Z") });
    await new DigestService(deps).generate("cron", { now: new Date("2026-09-05T06:00:00Z") });

    expect(created[0].period_start.toISOString()).toBe("2026-08-29T06:00:03.000Z");
    expect(created[0].period_end.toISOString()).toBe("2026-09-05T06:00:00.000Z");
  });

  it("uses the frequency as a lookback when no digest exists yet", async () => {
    const { deps, created } = makeDeps({ latest: null, frequencyDays: 7 });
    await new DigestService(deps).generate("cron", { now: new Date("2026-09-05T06:00:00Z") });

    expect(created[0].period_start.toISOString()).toBe("2026-08-29T06:00:00.000Z");
  });

  it("records the trigger it was called with", async () => {
    const { deps, created } = makeDeps();
    await new DigestService(deps).generate("manual", { now: new Date("2026-09-05T06:00:00Z") });

    expect(created[0].trigger_source).toBe("manual");
  });

  it("windows every read on the same bounds", async () => {
    const { deps } = makeDeps({ latest: digestAt("2026-08-29T06:00:00Z") });
    const now = new Date("2026-09-05T06:00:00Z");
    await new DigestService(deps).generate("cron", { now });

    const start = new Date("2026-08-29T06:00:00Z");
    for (const call of [
      deps.contributionRepo.findCreatedBetween,
      deps.challengeRepo.findCreatedBetween,
      deps.challengeRepo.findClosedBetween,
      deps.userRepo.findCreatedBetween,
      deps.rewardEntryRepo.findCreatedBetween,
    ]) {
      expect(call).toHaveBeenCalledWith(start, now);
    }
  });

  it("loads contribution members only for the windowed contributions", async () => {
    // Sinon la lecture grossit avec l'historique au lieu de la période.
    const contributions = [
      { uuid: "c-1", user_id: ALICE, challenge_id: CH } as Contribution,
      { uuid: "c-2", user_id: BOB, challenge_id: CH } as Contribution,
    ];
    const { deps, memberLookups } = makeDeps({ contributions });
    await new DigestService(deps).generate("cron", { now: new Date("2026-09-05T06:00:00Z") });

    expect(memberLookups).toEqual([["c-1", "c-2"]]);
  });

  it("reports a closed challenge's lifetime payout, not the window's", async () => {
    const closed = {
      uuid: CH, title: "Build the API", status: "completed", type: "code",
      contribution_points_reward: 1000, completion: 1, project_id: "p-1",
      created_at: new Date("2026-08-01T00:00:00Z"),
      closed_at: new Date("2026-09-03T00:00:00Z"),
    } as Challenge;
    const { deps, created } = makeDeps({ challengesClosed: [closed] });
    await new DigestService(deps).generate("cron", { now: new Date("2026-09-05T06:00:00Z") });

    expect(deps.rewardEntryRepo.sumByChallenge).toHaveBeenCalledWith(CH);
    expect(created[0].payload.completed_challenges[0].cp_awarded).toBe(840);
  });

  it("honours an explicit period start", async () => {
    // Le bouton « Generate now » laisse choisir la borne basse : c'est ce qui
    // permet de rattraper une période alors qu'un digest vide a déjà consommé
    // le curseur.
    const { deps, created } = makeDeps({ latest: digestAt("2026-09-05T06:00:00Z") });
    await new DigestService(deps).generate("manual", {
      now: new Date("2026-09-05T12:00:00Z"),
      periodStart: new Date("2026-09-01T00:00:00Z"),
    });

    expect(created[0].period_start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(created[0].period_end.toISOString()).toBe("2026-09-05T12:00:00.000Z");
  });

  it("windows the reads on the explicit start too", async () => {
    const { deps } = makeDeps({ latest: digestAt("2026-09-05T06:00:00Z") });
    const now = new Date("2026-09-05T12:00:00Z");
    const start = new Date("2026-09-01T00:00:00Z");
    await new DigestService(deps).generate("manual", { now, periodStart: start });

    expect(deps.contributionRepo.findCreatedBetween).toHaveBeenCalledWith(start, now);
  });

  it("refuses a start that is not before the end", async () => {
    // Une fenêtre vide ou inversée ne produirait rien d'exploitable.
    const { deps } = makeDeps();
    await expect(
      new DigestService(deps).generate("manual", {
        now: new Date("2026-09-05T12:00:00Z"),
        periodStart: new Date("2026-09-05T12:00:00Z"),
      }),
    ).rejects.toThrow();
  });

  it("generates a valid, mostly empty digest over a short window", async () => {
    // Un "Generate now" juste après un digest automatique est légitime.
    const { deps, created } = makeDeps({ latest: digestAt("2026-09-05T06:00:00Z") });
    await new DigestService(deps).generate("manual", { now: new Date("2026-09-05T06:05:00Z") });

    expect(created[0].payload).toMatchObject({
      version: 1,
      new_contributions: [], new_challenges: [], completed_challenges: [],
      new_contributors: [], cp_distributed: [],
    });
  });

  it("does not re-fetch a contributor already loaded by the window", async () => {
    // new_contributors et les lookups se recouvrent : Alice ne doit pas être
    // relue une seconde fois juste parce qu'elle a aussi contribué.
    const alice = {
      uuid: ALICE, full_name: "Alice Dupont", role: "contributor",
      created_at: new Date("2026-09-02T00:00:00Z"),
    } as User;
    const { deps } = makeDeps({
      contributors: [alice],
      contributions: [{ uuid: "c-1", user_id: ALICE, challenge_id: CH } as Contribution],
    });
    await new DigestService(deps).generate("cron", { now: new Date("2026-09-05T06:00:00Z") });

    expect(deps.userRepo.findById).not.toHaveBeenCalledWith(ALICE);
  });
});
