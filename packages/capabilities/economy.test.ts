import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PlatformRegistry } from "../registry/platform.js";
import { countsAsContribution, listExternalRewards, profileAggregateOf, ruleKeyLabel } from "./economy.js";

const summarize = async () => [{ id: "s1", label: "Fix", icon: null, count: 2, totalCp: 10 }];

describe("platform economy", () => {
  beforeEach(() => {
    PlatformRegistry.reset();
    PlatformRegistry.install({
      flows: [
        {
          descriptor: { key: "alpha", label: "A", longLabel: "A", icon: "code", briefRequired: true, publiclyVisible: true },
          ruleKeys: [{ key: "alpha_score", consumesPool: true, label: "Alpha score" }, { key: "alpha_bare", consumesPool: true }],
          contributionTypes: [{ key: "project", countsAsContribution: true }],
        },
      ],
      extensions: [
        {
          key: "chat",
          appliesTo: "*",
          ruleKeys: [
            {
              key: "chat_signal",
              consumesPool: false,
              label: "Chat signal",
              describe: (meta) => (typeof meta?.name === "string" ? meta.name : undefined),
            },
          ],
          contributionTypes: [{ key: "discussion", countsAsContribution: false, profileAggregate: { title: "Discussion", summarize } }],
        },
      ],
      modules: [
        { key: "box", cpSource: { key: "box", listAll: async () => [{ user_id: "u1", points: 50, created_at: new Date("2026-01-01") }] } },
        { key: "plain" },
      ],
    });
  });

  afterEach(() => PlatformRegistry.reset());

  it("counts declared submissions and undeclared types, not aggregates", () => {
    expect(countsAsContribution("project")).toBe(true);
    expect(countsAsContribution("discussion")).toBe(false);
    expect(countsAsContribution("never_declared")).toBe(true);
  });

  it("finds the profile summary of an aggregate type", async () => {
    expect(profileAggregateOf("project")).toBeUndefined();
    expect(await profileAggregateOf("discussion")?.summarize({ challengeId: "c", contributionId: "k" })).toHaveLength(1);
  });

  it("labels a ledger row from its meta, then its key, then the raw key", () => {
    expect(ruleKeyLabel("chat_signal", { name: "Great teamwork" })).toBe("Great teamwork");
    expect(ruleKeyLabel("chat_signal", null)).toBe("Chat signal");
    expect(ruleKeyLabel("alpha_score")).toBe("Alpha score");
    expect(ruleKeyLabel("alpha_bare")).toBe("alpha_bare");
    expect(ruleKeyLabel("mystery")).toBe("mystery");
  });

  it("gathers the CP of every installed source", async () => {
    expect(await listExternalRewards()).toEqual([{ user_id: "u1", points: 50, created_at: new Date("2026-01-01") }]);
  });
});
