import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../packages/database-service/repositories/index.js", () => ({
  ChallengeRepository: class {},
  RewardEntryRepository: class {},
}));

import { runAnnotationAudit, type AuditDeps } from "./audit.js";

const CHALLENGE = { uuid: "challenge-1", type: "data-annotation", reward_rules: { per_unit_cp: 10, gold_rate: 0.1, audit_rate: 0.5 } };

let deps: AuditDeps;
let stamped: Set<string>;

const item = (uuid: string, consensus: string) => ({ uuid, resource_type: "item", resolution: { consensus } });
const label = (user: string, resource: string, value: string) => ({
  claim_id: `${user}-${resource}`, resource_id: resource, resource_type: "item", user_id: user, payload: {}, result: { value }, consumed_at: new Date(),
});

beforeEach(() => {
  stamped = new Set();
  deps = {
    challengeRepo: { findAll: vi.fn(async () => [CHALLENGE, { uuid: "code-1", type: "code" }] as never) },
    rewardRepo: {
      findByChallenge: vi.fn(async () => [
        { rule_key: "annotation", user_id: "a", contribution_id: "ca", points: 10, meta: { claim_id: "a-i1" } },
        { rule_key: "annotation", user_id: "b", contribution_id: "cb", points: 7, meta: { claim_id: "b-i1" } },
        { rule_key: "annotation", user_id: "c", contribution_id: "cc", points: 9, meta: { claim_id: "c-i1" } },
        { rule_key: "annotation", user_id: "b", contribution_id: "cb", points: 6, meta: { claim_id: "b-i2" } },
      ] as never),
      createManyAndSyncRewards: vi.fn(async (drafts) => drafts as never),
    },
    res: {
      list: vi.fn(async () => [item("i1", "benign"), item("i2", "benign")] as never),
      // L'UPDATE conditionnel : la marque ne se pose qu'une fois.
      stampResolution: vi.fn(async (id: string) => {
        if (stamped.has(id)) return null;
        stamped.add(id);
        return item(id, "benign") as never;
      }),
      consumedClaims: vi.fn(async (id: string) =>
        (id === "i1"
          ? [label("a", "i1", "benign"), label("b", "i1", "malignant"), label("c", "i1", "benign")]
          : [label("b", "i2", "malignant")]) as never
      ),
    },
    random: vi.fn(() => 0.1),
    now: () => new Date("2026-09-21T04:00:00Z"),
  };
});

describe("runAnnotationAudit", () => {
  it("claws back what each dissenting label paid, on sampled items only", async () => {
    vi.mocked(deps.random).mockReturnValueOnce(0.1).mockReturnValueOnce(0.9); // i1 tiré, i2 non

    const summary = await runAnnotationAudit(deps);

    expect(deps.res.list).toHaveBeenCalledTimes(1);
    expect(deps.res.list).toHaveBeenCalledWith({ challengeId: "challenge-1", type: "item", verdict: "labeled", withoutResolutionKey: "audit" });
    expect(deps.res.stampResolution).toHaveBeenCalledWith("i1", "audit", { at: "2026-09-21T04:00:00.000Z", sampled: true });
    expect(deps.res.stampResolution).toHaveBeenCalledWith("i2", "audit", { at: "2026-09-21T04:00:00.000Z", sampled: false });
    expect(deps.rewardRepo.createManyAndSyncRewards).toHaveBeenCalledTimes(1);
    expect(deps.rewardRepo.createManyAndSyncRewards).toHaveBeenCalledWith([
      { challenge_id: "challenge-1", user_id: "b", contribution_id: "cb", rule_key: "annotation_clawback", points: -7, meta: { claim_id: "b-i1" } },
    ]);
    expect(summary).toEqual({ items: 2, sampled: 1, clawbacks: 1, points: 7 });
  });

  it("is idempotent: an item already stamped is never clawed back twice", async () => {
    await runAnnotationAudit(deps);
    const again = await runAnnotationAudit(deps);

    expect(deps.rewardRepo.createManyAndSyncRewards).toHaveBeenCalledTimes(2); // i1 et i2 au premier passage
    expect(again).toEqual({ items: 0, sampled: 0, clawbacks: 0, points: 0 });
  });

  it("does not claw back a label that paid nothing, or was already clawed back", async () => {
    vi.mocked(deps.rewardRepo.findByChallenge).mockResolvedValue([
      { rule_key: "annotation", user_id: "b", points: 7, meta: { claim_id: "b-i1" } },
      { rule_key: "annotation_clawback", user_id: "b", points: -7, meta: { claim_id: "b-i1" } },
    ] as never);
    vi.mocked(deps.res.list).mockResolvedValue([item("i1", "benign")] as never);

    await runAnnotationAudit(deps);

    expect(deps.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });
});
