import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  res: {
    createMany: vi.fn(),
    counts: vi.fn(),
    consumedBy: vi.fn(),
    list: vi.fn(),
    resource: vi.fn(),
    reclose: vi.fn(),
  },
  rewardRepo: { sumByChallenge: vi.fn(), findByChallenge: vi.fn() },
  userRepo: { findByIds: vi.fn() },
}));

vi.mock("../../../../packages/database-service/repositories/index.js", () => ({
  RewardEntryRepository: class { constructor() { return h.rewardRepo; } },
  UserRepository: class { constructor() { return h.userRepo; } },
}));
vi.mock("../../../../packages/capabilities/resources.js", () => ({ resources: () => h.res }));

import { actionContext, type ActionContextOptions } from "../../../../packages/capabilities/testing/action-context.js";
import { exportLabels, importBatch, overview, readBatch, resolveItem } from "./campaign.js";
import { annotationConfigSchema } from "../config.js";

const FLOW_CONFIG = {
  k: 3,
  ttl_hours: 24,
  label_schema: { kind: "single_choice", options: [{ key: "benign", label: "Benign" }, { key: "malignant", label: "Malignant" }] },
  sensitive_clearance: { min_seen: 2, min_accuracy: 0.8 },
};
const CHALLENGE = { uuid: "challenge-1", slug: "mammo", type: "data-annotation", contribution_points_reward: 500, flow_config: FLOW_CONFIG };
const CONFIG = annotationConfigSchema.parse(FLOW_CONFIG);

const ctx = (options: ActionContextOptions = {}) =>
  actionContext({ challenge: CHALLENGE as never, user: { id: "admin-1", role: "admin" }, ...options });

const claim = (user: string, resource: string, type: string, value: string, expected?: string) => ({
  claim_id: `${user}-${resource}`, resource_id: resource, resource_type: type, user_id: user,
  payload: expected ? { image_url: "u", expected } : { image_url: "u" }, result: { value }, consumed_at: new Date(),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.rewardRepo.sumByChallenge.mockResolvedValue(0);
  h.rewardRepo.findByChallenge.mockResolvedValue([]);
  h.userRepo.findByIds.mockResolvedValue([]);
});

describe("readBatch", () => {
  it("reads items, standard by default", () => {
    expect(readBatch("items", "image_url,class\nhttps://x/1.png,\nhttps://x/2.png,sensitive", CONFIG)).toEqual({
      rows: [
        { payload: { image_url: "https://x/1.png" }, class: "standard" },
        { payload: { image_url: "https://x/2.png" }, class: "sensitive" },
      ],
      errors: [],
    });
  });

  it("keeps the expected answer of a gold inside its payload", () => {
    expect(readBatch("golds", "image_url,expected\nhttps://x/g.png,benign", CONFIG).rows).toEqual([
      { payload: { image_url: "https://x/g.png", expected: "benign" }, class: null },
    ]);
  });

  it("names every invalid line", () => {
    const { errors } = readBatch("golds", "image_url,expected\njavascript:alert(1),benign\nhttps://x/g.png,maybe", CONFIG);
    expect(errors).toEqual([
      "Line 2: image_url must be an http(s) URL",
      "Line 3: expected must be one of the label option keys",
    ]);
  });

  it("refuses an empty file and an unknown class", () => {
    expect(readBatch("items", "image_url\n", CONFIG).errors).toEqual(["The file has no data rows"]);
    expect(readBatch("items", "image_url,class\nhttps://x/1.png,secret", CONFIG).errors).toHaveLength(1);
  });
});

describe("POST batches", () => {
  it("imports all rows under the resource type of their kind", async () => {
    h.res.createMany.mockResolvedValue(2);
    const result = await importBatch(ctx({ body: { kind: "golds", csv: "image_url,expected\nhttps://x/1.png,benign\nhttps://x/2.png,malignant" } }));

    expect(result).toEqual({ kind: "golds", created: 2 });
    expect(h.res.createMany).toHaveBeenCalledWith("challenge-1", "gold", expect.any(Array), { createdBy: "admin-1" });
  });

  it("writes nothing when one row is invalid", async () => {
    const result = await importBatch(ctx({ body: { kind: "items", csv: "image_url\nhttps://x/1.png\nnot-a-url" } }));

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
    expect(h.res.createMany).not.toHaveBeenCalled();
  });
});

describe("GET overview", () => {
  it("reports progress, live accuracy per annotator, contested tallies and the pool", async () => {
    h.res.counts.mockResolvedValue([
      { type: "item", state: "open", verdict: null, total: 5 },
      { type: "item", state: "closed", verdict: "labeled", total: 3 },
      { type: "item", state: "closed", verdict: "contested", total: 1 },
      { type: "gold", state: "open", verdict: null, total: 4 },
    ]);
    h.res.consumedBy.mockResolvedValue([
      claim("u1", "g1", "gold", "benign", "benign"),
      claim("u1", "i9", "item", "benign"),
      claim("u2", "g1", "gold", "malignant", "benign"),
      claim("u2", "i9", "item", "malignant"),
    ]);
    h.res.list.mockResolvedValue([{ uuid: "i9", payload: { image_url: "https://x/9.png" } }]);
    h.rewardRepo.sumByChallenge.mockResolvedValue(120);
    h.rewardRepo.findByChallenge.mockResolvedValue([
      { user_id: "u1", rule_key: "annotation", points: 20 },
      { user_id: "u2", rule_key: "annotation", points: 10 },
      { user_id: "u2", rule_key: "annotation_clawback", points: -10 },
    ]);
    h.userRepo.findByIds.mockResolvedValue([{ uuid: "u1", full_name: "Alice" }]);

    const result = (await overview(ctx())) as any;

    expect(result.items).toEqual({ total: 9, open: 5, labeled: 3, contested: 1 });
    expect(result.golds).toBe(4);
    expect(result.pool).toEqual({ pool: 500, distributed: 120, remaining: 380 });
    expect(result.annotators).toEqual([
      { user_id: "u1", name: "Alice", labels: 2, gold_seen: 1, gold_correct: 1, accuracy: 1, cp: 20 },
      { user_id: "u2", name: "Unknown", labels: 2, gold_seen: 1, gold_correct: 0, accuracy: 0, cp: 0 },
    ]);
    expect(result.contested).toEqual([{ resource_id: "i9", image_url: "https://x/9.png", tally: { benign: 1, malignant: 1 } }]);
  });
});

describe("POST items/:resourceId/resolve", () => {
  const resolveCtx = (value: string) => ctx({ body: { value }, params: { resourceId: "i9" } });

  it("settles a contested item of this challenge", async () => {
    h.res.resource.mockResolvedValue({ uuid: "i9", challenge_id: "challenge-1", resource_type: "item" });
    h.res.reclose.mockResolvedValue({ uuid: "i9", verdict: "labeled" });

    expect(await resolveItem(resolveCtx("malignant"))).toEqual({ resource_id: "i9", verdict: "labeled", consensus: "malignant" });
    expect(h.res.reclose).toHaveBeenCalledWith("i9", "contested", "labeled", expect.objectContaining({ consensus: "malignant", resolved_by: "admin-1" }));
  });

  it("refuses a gold, another challenge's item, and an item that is not contested", async () => {
    h.res.resource.mockResolvedValue({ uuid: "i9", challenge_id: "challenge-1", resource_type: "gold" });
    expect(((await resolveItem(resolveCtx("benign"))) as Response).status).toBe(404);

    h.res.resource.mockResolvedValue({ uuid: "i9", challenge_id: "other", resource_type: "item" });
    expect(((await resolveItem(resolveCtx("benign"))) as Response).status).toBe(404);

    h.res.resource.mockResolvedValue({ uuid: "i9", challenge_id: "challenge-1", resource_type: "item" });
    h.res.reclose.mockResolvedValue(null);
    expect(((await resolveItem(resolveCtx("benign"))) as Response).status).toBe(409);
  });
});

describe("GET export", () => {
  it("returns a CSV of closed items with their consensus", async () => {
    h.res.list.mockResolvedValue([
      { uuid: "i1", payload: { image_url: "https://x/1.png" }, verdict: "labeled", resolution: { consensus: "benign" } },
      { uuid: "i2", payload: { image_url: "https://x/2.png" }, verdict: "contested", resolution: {} },
    ]);
    h.res.consumedBy.mockResolvedValue([claim("a", "i1", "item", "benign"), claim("b", "i1", "item", "benign"), claim("a", "i2", "item", "x")]);

    const response = (await exportLabels(ctx())) as Response;

    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain("annotations-mammo.csv");
    expect(await response.text()).toBe(
      "image_url,consensus,k,contested\r\nhttps://x/1.png,benign,2,false\r\nhttps://x/2.png,,1,true\r\n"
    );
  });
});
