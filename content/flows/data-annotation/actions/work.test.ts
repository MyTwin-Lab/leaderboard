import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  res: {
    activeClaim: vi.fn(),
    consumedBy: vi.fn(),
    draw: vi.fn(),
    claim: vi.fn(),
    consume: vi.fn(),
    resource: vi.fn(),
    consumedClaims: vi.fn(),
    close: vi.fn(),
    release: vi.fn(),
  },
  contributionRepo: { createIfAbsent: vi.fn() },
  rewardRepo: { sumByChallenge: vi.fn(), createManyAndSyncRewards: vi.fn(), findByUserAndChallenge: vi.fn() },
  ClaimNotConsumableError: class extends Error {
    constructor(readonly reason: string) { super(reason); }
  },
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  ContributionRepository: class { constructor() { return h.contributionRepo; } },
  RewardEntryRepository: class { constructor() { return h.rewardRepo; } },
}));
vi.mock("../../../../packages/capabilities/resources.js", () => ({
  resources: () => h.res,
  ClaimNotConsumableError: h.ClaimNotConsumableError,
}));

import { actionContext, type ActionContextOptions } from "../../../../packages/capabilities/testing/action-context.js";
import { dataAnnotationActions } from "./index.js";
import { draw, label, progress, release } from "./work.js";

const CHALLENGE = {
  uuid: "challenge-1",
  type: "data-annotation",
  title: "Mammography",
  status: "active",
  contribution_points_reward: 1000,
  flow_config: {
    k: 3,
    ttl_hours: 24,
    label_schema: { kind: "single_choice", options: [{ key: "benign", label: "Benign" }, { key: "malignant", label: "Malignant" }] },
    sensitive_clearance: { min_seen: 2, min_accuracy: 0.8 },
  },
  reward_rules: { per_unit_cp: 10, gold_rate: 0.2, audit_rate: 0.1 },
};

const ctx = (options: ActionContextOptions = {}) =>
  actionContext({ challenge: CHALLENGE as never, user: { id: "ann", role: "contributor" }, access: { member: true }, ...options });

const consumed = (type: "item" | "gold", value: string, expected?: string) => ({
  claim_id: `c-${Math.random()}`, resource_id: "r", resource_type: type, user_id: "ann",
  payload: expected ? { image_url: "https://x/g.png", expected } : { image_url: "https://x/i.png" },
  result: { value }, consumed_at: new Date(),
});

async function json(result: unknown): Promise<{ status: number; body: any }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.res.activeClaim.mockResolvedValue(null);
  h.res.consumedBy.mockResolvedValue([]);
  h.res.draw.mockResolvedValue(null);
  h.rewardRepo.sumByChallenge.mockResolvedValue(0);
  h.rewardRepo.createManyAndSyncRewards.mockResolvedValue([]);
  h.rewardRepo.findByUserAndChallenge.mockResolvedValue([]);
  h.contributionRepo.createIfAbsent.mockResolvedValue({ contribution: { uuid: "contrib-1" }, created: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("data annotation — declared access", () => {
  const access = (method: string, path: string) => dataAnnotationActions.find((a) => a.method === method && a.path === path)?.access;

  it.each([
    ["POST", "draw"],
    ["POST", "claims/:claimId/label"],
    ["POST", "claims/:claimId/release"],
    ["GET", "progress"],
  ])("keeps %s %s to participants", (method, path) => {
    expect(access(method, path)).toEqual({ member: true });
  });

  it.each([
    ["POST", "batches"],
    ["GET", "overview"],
    ["POST", "items/:resourceId/resolve"],
    ["GET", "export"],
  ])("keeps %s %s to admins and the project manager", (method, path) => {
    expect(access(method, path)).toEqual({ roles: ["admin"], manager: true });
  });
});

describe("POST draw", () => {
  it("serves the image and the options, never the type nor the expected answer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1); // < gold_rate : un gold
    h.res.draw.mockResolvedValueOnce({
      claimId: "claim-1", resourceId: "gold-1", payload: { image_url: "https://x/g.png", expected: "benign" }, expiresAt: null,
    });

    const { body } = await json(await draw(ctx()));

    expect(h.res.draw).toHaveBeenCalledWith("challenge-1", "ann", { type: "gold", ttlHours: 24 });
    expect(body).toEqual({
      claim: { claim_id: "claim-1", image_url: "https://x/g.png", options: CHALLENGE.flow_config.label_schema.options, expires_at: null },
    });
    expect(JSON.stringify(body)).not.toMatch(/gold|expected/);
  });

  it("falls back to a standard item when no unseen gold is left", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    h.res.draw.mockResolvedValueOnce(null).mockResolvedValueOnce({
      claimId: "claim-2", resourceId: "item-1", payload: { image_url: "https://x/i.png" }, expiresAt: null,
    });

    await draw(ctx());

    expect(h.res.draw).toHaveBeenLastCalledWith("challenge-1", "ann", { type: "item", k: 3, ttlHours: 24, class: "standard" });
  });

  it("opens sensitive items to a cleared annotator", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // pas de gold
    // Onze golds justes, au-delà du décalage de qualité.
    h.res.consumedBy.mockResolvedValue(Array.from({ length: 12 }, () => consumed("gold", "benign", "benign")));

    await draw(ctx());

    expect(h.res.draw).toHaveBeenCalledTimes(1);
    expect(h.res.draw).toHaveBeenCalledWith("challenge-1", "ann", { type: "item", k: 3, ttlHours: 24, class: undefined });
  });

  it("serves the active claim again instead of drawing a new one", async () => {
    h.res.activeClaim.mockResolvedValue({
      claim: { uuid: "claim-9", expires_at: null }, resource: { payload: { image_url: "https://x/g.png", expected: "benign" } },
    });

    const { body } = await json(await draw(ctx()));

    expect(h.res.draw).not.toHaveBeenCalled();
    expect(body.claim.claim_id).toBe("claim-9");
    expect(body.claim).not.toHaveProperty("expected");
  });

  it("answers an empty claim when nothing is left", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(await draw(ctx())).toEqual({ claim: null });
  });

  it("refuses to draw on a closed challenge", async () => {
    const { status } = await json(await draw(ctx({ challenge: { ...CHALLENGE, status: "completed" } as never })));
    expect(status).toBe(409);
  });
});

describe("POST claims/:claimId/label", () => {
  const labelCtx = (value: unknown) => ctx({ body: { value }, params: { claimId: "claim-1" } });

  beforeEach(() => {
    h.res.claim.mockResolvedValue({ uuid: "claim-1", user_id: "ann", challenge_id: "challenge-1", resource_id: "item-1" });
    h.res.consume.mockResolvedValue({});
    h.res.resource.mockResolvedValue({ uuid: "item-1", resource_type: "item", state: "open" });
    h.res.consumedClaims.mockResolvedValue([consumed("item", "benign")]);
  });

  it("refuses a value outside the label options", async () => {
    expect((await json(await label(labelCtx("maybe")))).status).toBe(400);
    expect(h.res.consume).not.toHaveBeenCalled();
  });

  it("refuses someone else's claim", async () => {
    h.res.claim.mockResolvedValue({ uuid: "claim-1", user_id: "other", challenge_id: "challenge-1", resource_id: "item-1" });
    expect((await json(await label(labelCtx("benign")))).status).toBe(404);
  });

  it.each([["consumed", 409], ["lapsed", 410], ["not_found", 404]])("turns a %s claim into %i", async (reason, status) => {
    h.res.consume.mockRejectedValue(new h.ClaimNotConsumableError(reason));
    expect((await json(await label(labelCtx("benign")))).status).toBe(status);
    expect(h.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });

  it("pays one ledger row tied to the claim, at full rate while no gold counts", async () => {
    const { body } = await json(await label(labelCtx("benign")));

    expect(h.res.consume).toHaveBeenCalledWith("claim-1", "ann", { value: "benign" });
    expect(body).toEqual({ labeled: true, cp_awarded: 10 });
    expect(h.rewardRepo.createManyAndSyncRewards).toHaveBeenCalledWith([
      { challenge_id: "challenge-1", user_id: "ann", contribution_id: "contrib-1", rule_key: "annotation", points: 10, meta: { claim_id: "claim-1" } },
    ]);
    expect(h.res.close).not.toHaveBeenCalled();
  });

  it("weights the pay by accuracy and clamps it to the pool", async () => {
    // Deux golds au-delà du décalage, un juste : précision 0,5.
    h.res.consumedBy.mockResolvedValue([
      ...Array.from({ length: 10 }, () => consumed("item", "benign")),
      consumed("gold", "benign", "benign"),
      consumed("gold", "benign", "malignant"),
    ]);
    h.rewardRepo.sumByChallenge.mockResolvedValue(990);
    expect((await json(await label(labelCtx("benign")))).body.cp_awarded).toBe(5);

    h.rewardRepo.sumByChallenge.mockResolvedValue(997);
    expect((await json(await label(labelCtx("benign")))).body.cp_awarded).toBe(3);
  });

  it("answers a gold exactly like an item", async () => {
    const item = await json(await label(labelCtx("benign")));
    h.res.resource.mockResolvedValue({ uuid: "gold-1", resource_type: "gold", state: "open" });
    const gold = await json(await label(labelCtx("malignant")));

    expect(gold).toEqual(item);
  });

  it("resolves an item at its k-th label by strict plurality", async () => {
    h.res.consumedClaims.mockResolvedValue([consumed("item", "benign"), consumed("item", "malignant"), consumed("item", "benign")]);
    await label(labelCtx("benign"));
    expect(h.res.close).toHaveBeenCalledWith("item-1", "labeled", { consensus: "benign" });
  });

  it("closes an item without plurality as contested", async () => {
    const config = { ...CHALLENGE.flow_config, k: 5, label_schema: { kind: "single_choice", options: ["a", "b", "c"].map((key) => ({ key, label: key })) } };
    h.res.consumedClaims.mockResolvedValue(["a", "a", "b", "b", "c"].map((v) => consumed("item", v)));

    await label(ctx({ challenge: { ...CHALLENGE, flow_config: config } as never, body: { value: "c" }, params: { claimId: "claim-1" } }));

    expect(h.res.close).toHaveBeenCalledWith("item-1", "contested", {});
  });

  it("never resolves a gold", async () => {
    h.res.resource.mockResolvedValue({ uuid: "gold-1", resource_type: "gold", state: "open" });
    h.res.consumedClaims.mockResolvedValue(Array.from({ length: 5 }, () => consumed("gold", "benign", "benign")));
    await label(labelCtx("benign"));
    expect(h.res.close).not.toHaveBeenCalled();
  });

  it("writes nothing once the pool is empty", async () => {
    h.rewardRepo.sumByChallenge.mockResolvedValue(1000);
    const { body } = await json(await label(labelCtx("benign")));
    expect(body.cp_awarded).toBe(0);
    expect(h.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });
});

describe("POST claims/:claimId/release", () => {
  it("releases an active claim of the caller", async () => {
    h.res.claim.mockResolvedValue({ uuid: "claim-1", user_id: "ann", challenge_id: "challenge-1" });
    h.res.release.mockResolvedValue(true);
    expect(await release(ctx({ method: "POST", params: { claimId: "claim-1" } }))).toEqual({ released: true });
  });

  it("answers 409 when the claim is no longer active", async () => {
    h.res.claim.mockResolvedValue({ uuid: "claim-1", user_id: "ann", challenge_id: "challenge-1" });
    h.res.release.mockResolvedValue(false);
    expect((await json(await release(ctx({ method: "POST", params: { claimId: "claim-1" } })))).status).toBe(409);
  });
});

describe("GET progress", () => {
  it("reports labels, net CP and a lagged quality score", async () => {
    h.res.consumedBy.mockResolvedValue([
      consumed("gold", "malignant", "benign"), // récent : ne compte pas encore
      ...Array.from({ length: 9 }, () => consumed("item", "benign")),
      consumed("gold", "benign", "benign"),
    ]);
    h.rewardRepo.findByUserAndChallenge.mockResolvedValue([
      { rule_key: "annotation", points: 10 },
      { rule_key: "annotation_clawback", points: -10 },
      { rule_key: "annotation", points: 8 },
      { rule_key: "slack_signal", points: 50 },
    ]);

    expect(await progress(ctx())).toEqual({
      labeled: 11,
      cp_earned: 8,
      quality_score: 1,
      sensitive_cleared: false,
      has_active_claim: false,
    });
  });
});
