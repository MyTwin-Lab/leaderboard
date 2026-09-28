import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConnectorRegistry, type ConnectorDefinition } from "./registry.js";
import type { ExternalConnector } from "./interfaces.js";

function fakeConnector(type: string): ExternalConnector {
  return {
    name: `fake ${type}`,
    type,
    authConfig: {},
    connect: async () => {},
    testConnection: async () => true,
    fetchItems: async () => [],
    fetchItemContent: async () => null,
  };
}

function definition(key: string, repoTypes: string[], create?: ConnectorDefinition["create"]): ConnectorDefinition {
  return { key, repoTypes, create: create ?? (async (repo) => fakeConnector(repo.type)) };
}

describe("ConnectorRegistry", () => {
  beforeEach(() => {
    ConnectorRegistry.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    ConnectorRegistry.clear();
    vi.restoreAllMocks();
  });

  it("dispatches a repo to the connector that declares its type", async () => {
    const create = vi.fn(async () => fakeConnector("kaggle_model"));
    ConnectorRegistry.register(definition("github", ["github"]));
    ConnectorRegistry.register(definition("kaggle", ["kaggle_dataset", "kaggle_model"], create));

    const connector = await ConnectorRegistry.createConnector(
      { type: "kaggle_model", external_repo_id: "acme/model" },
      { branch: "main" }
    );

    expect(connector?.type).toBe("kaggle_model");
    expect(create).toHaveBeenCalledWith({ type: "kaggle_model", external_repo_id: "acme/model" }, { branch: "main" });
  });

  it("returns null for a repo type no installed connector reads", async () => {
    ConnectorRegistry.register(definition("github", ["github"]));

    expect(await ConnectorRegistry.createConnector({ type: "google_drive" })).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("says so when nothing is installed at all", async () => {
    expect(await ConnectorRegistry.createConnector({ type: "github" })).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/No connector installed/));
  });

  it("refuses a connector key registered twice", () => {
    ConnectorRegistry.register(definition("github", ["github"]));
    expect(() => ConnectorRegistry.register(definition("github", ["github_enterprise"]))).toThrow(/already registered/);
  });

  it("refuses a repo type claimed by two connectors", () => {
    ConnectorRegistry.register(definition("github", ["github"]));
    expect(() => ConnectorRegistry.register(definition("mirror", ["github"]))).toThrow(/already handled by connector "github"/);
    expect(ConnectorRegistry.has("mirror")).toBe(false);
  });
});
