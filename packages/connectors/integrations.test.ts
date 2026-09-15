import { describe, it, expect, beforeEach } from "vitest";
import { IntegrationRegistry, integrationConnected, type IntegrationDefinition } from "./integrations.js";

function definition(key: string, over: Partial<IntegrationDefinition> = {}): IntegrationDefinition {
  return {
    key,
    label: key,
    connectionLabel: "API key connection",
    description: "",
    auth: { kind: "api_key", fields: [], connect: async () => ({ ok: true, secret: "s" }) },
    ...over,
  };
}

beforeEach(() => {
  IntegrationRegistry.clear();
});

describe("IntegrationRegistry", () => {
  it("lists integrations in registration order", () => {
    IntegrationRegistry.register(definition("github"));
    IntegrationRegistry.register(definition("kaggle"));

    expect(IntegrationRegistry.list().map((d) => d.key)).toEqual(["github", "kaggle"]);
    expect(IntegrationRegistry.get("kaggle")?.key).toBe("kaggle");
    expect(IntegrationRegistry.get("slack")).toBeUndefined();
  });

  it("refuses a key registered twice", () => {
    IntegrationRegistry.register(definition("github"));

    expect(() => IntegrationRegistry.register(definition("github"))).toThrow('Integration "github" is already registered');
  });
});

describe("integrationConnected", () => {
  const status = { connected: true, meta: { disconnect_requested_at: "2026-09-15" }, connectedAt: null, connectedBy: null };

  it("follows the stored secret by default", () => {
    expect(integrationConnected(definition("kaggle"), status)).toBe(true);
    expect(integrationConnected(definition("kaggle"), { ...status, connected: false })).toBe(false);
  });

  it("lets an integration apply its own rule", () => {
    const scaleway = definition("scaleway", { isConnected: (s) => s.connected && !s.meta.disconnect_requested_at });

    expect(integrationConnected(scaleway, status)).toBe(false);
  });
});
