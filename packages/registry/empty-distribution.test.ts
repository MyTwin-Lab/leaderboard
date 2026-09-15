import { describe, it, expect, vi, afterEach } from "vitest";
import { PlatformRegistry } from "./platform.js";
import { ConnectorRegistry } from "../connectors/registry.js";
import { ProvisionerRegistry, provisionContributorWorkspace } from "../provisioner/src/index.js";
import { EvaluationGridRegistry } from "../evaluator/grids/index.js";

/**
 * Le core sans rien d'installé
 * ----------------------------
 * Une distribution vide — aucun flow, extension, connecteur ni provider — doit
 * laisser le core répondre : des registres vides, des « rien à faire » plutôt
 * que des erreurs. C'est la preuve que le core ne dépend d'aucun contenu, que
 * `prod:min` prétendait apporter sans rien désactiver.
 */
describe("core with an empty distribution", () => {
  afterEach(() => {
    PlatformRegistry.reset();
    ConnectorRegistry.clear();
    ProvisionerRegistry.clear();
    vi.restoreAllMocks();
  });

  it("installs a platform with no flow, and answers with empty lists", () => {
    PlatformRegistry.install({ flows: [] });

    expect(PlatformRegistry.flows()).toEqual([]);
    expect(PlatformRegistry.ruleKeys()).toEqual([]);
    expect(PlatformRegistry.contributionTypes()).toEqual([]);
    expect(PlatformRegistry.extensionsFor("anything")).toEqual([]);
    expect(PlatformRegistry.flow("code")).toBeUndefined();
  });

  it("builds no connector", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await ConnectorRegistry.createConnector({ type: "github", external_repo_id: "acme/widgets" })).toBeNull();
  });

  it("reports a failed provisioning instead of throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await provisionContributorWorkspace({
      challengeIndex: 1,
      username: "alice",
      repoExternalId: "acme/widgets",
      repoType: "github",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/No provider available/);
  });

  it("still serves the built-in grids without a database provider", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const grid = await EvaluationGridRegistry.getGridAsync("code");

    expect(grid.type).toBe("code");
  });
});
