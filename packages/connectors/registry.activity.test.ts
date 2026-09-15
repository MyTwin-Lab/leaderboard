import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConnectorRegistry, type ConnectorDefinition } from "./registry.js";
import { activityPayloads, isConnectorActivity } from "./activity.js";

const definition: ConnectorDefinition = {
  key: "demo",
  repoTypes: ["demo_a", "demo_b"],
  create: async () => null,
  activity: { repoTypes: ["demo_a"], toPublic: (payload) => payload },
};

describe("ConnectorRegistry — lookups", () => {
  let previous: string[];

  beforeEach(() => {
    previous = ConnectorRegistry.keys();
    ConnectorRegistry.clear();
    ConnectorRegistry.register(definition);
  });

  afterEach(() => {
    ConnectorRegistry.clear();
    expect(previous).toBeDefined();
  });

  it("finds a connector by key and by repo type", () => {
    expect(ConnectorRegistry.get("demo")).toBe(definition);
    expect(ConnectorRegistry.definitionFor("demo_b")).toBe(definition);
    expect(ConnectorRegistry.get("missing")).toBeUndefined();
  });

  it("validates a repo type against the installed connectors", () => {
    expect(ConnectorRegistry.isKnownRepoType("demo_a")).toBe(true);
    expect(ConnectorRegistry.isKnownRepoType("github")).toBe(false);
  });
});

describe("activity envelopes", () => {
  const activities = {
    "repo-1": { connectorKey: "github", payload: { events: [] } },
    "repo-2": { error: "unavailable" },
    "repo-3": { connectorKey: "kaggle", payload: { kind: "model" } },
    "repo-4": { connectorKey: "github", payload: { events: [1] } },
  };

  it("recognises an envelope, not an error entry", () => {
    expect(isConnectorActivity(activities["repo-1"])).toBe(true);
    expect(isConnectorActivity(activities["repo-2"])).toBe(false);
    expect(isConnectorActivity(null)).toBe(false);
  });

  it("collects the payloads of one connector, in repo order", () => {
    expect(activityPayloads(activities, "github")).toEqual([{ events: [] }, { events: [1] }]);
    expect(activityPayloads(null, "github")).toEqual([]);
  });
});
