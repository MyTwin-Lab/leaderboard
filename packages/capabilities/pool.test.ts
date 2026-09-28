import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlatformRegistry } from "../registry/platform.js";
import { distributedFromPool, outOfPoolRuleKeys, poolCompletion, remainingPool } from "./pool.js";

const flow = {
  descriptor: { key: "alpha", label: "A", longLabel: "A", icon: "code", briefRequired: true, publiclyVisible: true },
  ruleKeys: [{ key: "alpha_score", consumesPool: true }],
};

describe("challenge pool", () => {
  beforeEach(() => {
    PlatformRegistry.reset();
    PlatformRegistry.install({
      flows: [flow],
      extensions: [{ key: "chat", appliesTo: "*", ruleKeys: [{ key: "chat_signal", consumesPool: false }] }],
    });
  });

  afterEach(() => PlatformRegistry.reset());

  it("lists the installed keys that do not consume the pool", () => {
    expect(outOfPoolRuleKeys()).toEqual(["chat_signal"]);
  });

  it("sums the ledger without the out-of-pool keys", async () => {
    const ledger = { sumByChallenge: vi.fn(async () => 120) };

    expect(await distributedFromPool(ledger, "ch-1")).toBe(120);
    expect(ledger.sumByChallenge).toHaveBeenCalledWith("ch-1", { excludeRuleKeys: ["chat_signal"] });
  });

  it("never leaves a negative remainder", () => {
    expect(remainingPool(1000, 400)).toBe(600);
    expect(remainingPool(1000, 1200)).toBe(0);
  });

  it("caps completion at the whole pool, and gives 0 without a pool", () => {
    expect(poolCompletion(1000, 250)).toBe(0.25);
    expect(poolCompletion(1000, 1500)).toBe(1);
    expect(poolCompletion(0, 50)).toBe(0);
  });
});
