import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { Challenge, RewardEntry } from "../database-service/domain/entities.js";
import { PlatformRegistry } from "../registry/platform.js";
import { readChallengeRewards, type RewardsLedger } from "./rewards.js";

const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });

const summarize = vi.fn(async () => ({ metric: { name: "auc", points: [0.9] }, rules: { secret: true } }));

function challenge(over: Partial<Challenge> = {}): Challenge {
  return { uuid: "c-1", type: "scored", contribution_points_reward: 1000, ...over } as Challenge;
}

function entry(user_id: string, points: number, rule_key = "scored_key"): RewardEntry {
  return { uuid: `${user_id}-${points}`, user_id, points, rule_key, challenge_id: "c-1", created_at: new Date() } as RewardEntry;
}

function ledger(entries: RewardEntry[]): RewardsLedger & { maxMetaNumber: ReturnType<typeof vi.fn> } {
  return {
    findByChallenge: vi.fn(async () => entries),
    maxMetaNumber: vi.fn(async () => 0.9),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  PlatformRegistry.reset();
  PlatformRegistry.install({
    flows: [
      {
        descriptor: descriptor("scored"),
        rules: { parse: () => ({}) },
        ruleKeys: [{ key: "scored_key", consumesPool: true }],
        rewards: { summarize, publicFields: ["metric", "absent"] },
      },
      { descriptor: descriptor("plain-rules"), rules: { parse: () => ({}) } },
      { descriptor: descriptor("no-rules") },
    ],
    extensions: [{ key: "chat", appliesTo: "*", ruleKeys: [{ key: "chat_signal", consumesPool: false }] }],
  });
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("readChallengeRewards", () => {
  it("has nothing to say about a challenge whose flow has no reward rules", async () => {
    const repo = ledger([]);

    expect(await readChallengeRewards(challenge({ type: "no-rules" }), repo)).toBeNull();
    expect(repo.findByChallenge).not.toHaveBeenCalled();
  });

  it("computes the pool from the ledger, leaving out-of-pool rewards out of the distributed total", async () => {
    const reading = await readChallengeRewards(challenge({ type: "plain-rules" }), ledger([
      entry("u1", 100), entry("u2", 50), entry("u1", 20, "chat_signal"),
    ]));

    expect(reading?.full).toEqual({
      pool: 1000,
      distributed: 150,
      remaining: 850,
      breakdown: [{ userId: "u1", points: 120 }, { userId: "u2", points: 50 }],
    });
    expect(reading?.public).toEqual({});
  });

  it("never lets remaining go negative", async () => {
    const reading = await readChallengeRewards(challenge({ contribution_points_reward: 10, type: "plain-rules" }), ledger([entry("u1", 100)]));

    expect(reading?.full.remaining).toBe(0);
  });

  it("adds what the flow summarizes, reading the ledger through the challenge", async () => {
    const repo = ledger([entry("u1", 10)]);

    const reading = await readChallengeRewards(challenge(), repo);
    const ctx = summarize.mock.calls[0][0] as any;
    await ctx.maxMetaNumber({ ruleKey: "scored_key", field: "metricValue" });

    expect(reading?.full).toMatchObject({ metric: { name: "auc", points: [0.9] }, rules: { secret: true }, pool: 1000 });
    expect(ctx.entries).toHaveLength(1);
    expect(repo.maxMetaNumber).toHaveBeenCalledWith("c-1", { ruleKey: "scored_key", field: "metricValue" });
  });

  it("serves an anonymous visitor only the fields the flow declares public", async () => {
    const reading = await readChallengeRewards(challenge(), ledger([entry("u1", 260), entry("u2", 160)]));

    expect(reading?.public).toEqual({ metric: { name: "auc", points: [0.9] } });
    expect(JSON.stringify(reading?.public)).not.toContain("u1");
    expect(JSON.stringify(reading?.public)).not.toContain("secret");
  });

  it("does not let a flow override the pool fields", async () => {
    summarize.mockResolvedValueOnce({ pool: 1, distributed: 1 } as any);

    const reading = await readChallengeRewards(challenge(), ledger([entry("u1", 10)]));

    expect(reading?.full).toMatchObject({ pool: 1000, distributed: 10 });
  });
});
