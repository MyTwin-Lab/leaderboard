import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PlatformRegistry, type FlowDefinition, type PlatformDefinitions } from "./platform.js";

function flow(key: string, declarations: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    descriptor: { key, label: key, longLabel: key, icon: "code", briefRequired: true, publiclyVisible: true },
    ...declarations,
  };
}

const DISTRIBUTION: PlatformDefinitions = {
  flows: [
    flow("alpha", {
      ruleKeys: [{ key: "alpha_score", consumesPool: true }],
      contributionTypes: [{ key: "project", countsAsContribution: true }],
    }),
    flow("beta"),
  ],
  extensions: [
    {
      key: "chat",
      appliesTo: "*",
      ruleKeys: [{ key: "chat_signal", consumesPool: false }],
      contributionTypes: [{ key: "discussion", countsAsContribution: false }],
    },
    { key: "gpu", appliesTo: ["beta"] },
  ],
};

describe("PlatformRegistry", () => {
  // Le setup des tests installe la plateforme MyTwin : chaque cas repart à vide.
  beforeEach(() => PlatformRegistry.reset());
  afterEach(() => PlatformRegistry.reset());

  it("exposes what the installed distribution declares, with its owner", () => {
    PlatformRegistry.install(DISTRIBUTION);

    expect(PlatformRegistry.isInstalled()).toBe(true);
    expect(PlatformRegistry.flow("beta")?.descriptor.key).toBe("beta");
    expect(PlatformRegistry.flow("gamma")).toBeUndefined();
    expect(PlatformRegistry.ruleKey("chat_signal")).toEqual({ key: "chat_signal", consumesPool: false, owner: "extension:chat" });
    expect(PlatformRegistry.contributionType("project")?.owner).toBe("flow:alpha");
  });

  it("lists the extensions that attach to a flow", () => {
    PlatformRegistry.install(DISTRIBUTION);

    expect(PlatformRegistry.extensionsFor("alpha").map((e) => e.key)).toEqual(["chat"]);
    expect(PlatformRegistry.extensionsFor("beta").map((e) => e.key)).toEqual(["chat", "gpu"]);
  });

  it("refuses a rule key declared by two owners, and stays uninstalled", () => {
    expect(() =>
      PlatformRegistry.install({
        flows: [
          flow("alpha", { ruleKeys: [{ key: "shared", consumesPool: true }] }),
          flow("beta", { ruleKeys: [{ key: "shared", consumesPool: false }] }),
        ],
      })
    ).toThrow(/Rule key "shared" is declared by both flow:alpha and flow:beta/);
    expect(PlatformRegistry.isInstalled()).toBe(false);
  });

  it("refuses a contribution type declared by two owners", () => {
    expect(() =>
      PlatformRegistry.install({
        flows: [flow("alpha", { contributionTypes: [{ key: "project", countsAsContribution: true }] })],
        kits: [{ key: "shared", contributionTypes: [{ key: "project", countsAsContribution: false }] }],
      })
    ).toThrow(/Contribution type "project" is declared by both flow:alpha and kit:shared/);
  });

  it("refuses a flow installed twice", () => {
    expect(() => PlatformRegistry.install({ flows: [flow("alpha"), flow("alpha")] })).toThrow(/Flow "alpha" is installed twice/);
  });

  it("refuses an extension attached to a flow that is not installed", () => {
    expect(() =>
      PlatformRegistry.install({ flows: [flow("alpha")], extensions: [{ key: "gpu", appliesTo: ["beta"] }] })
    ).toThrow(/applies to flow "beta", which is not installed/);
  });

  it("finds an evaluation handler under the key of its owner", () => {
    const retry = async () => ({ ok: true as const });
    PlatformRegistry.install({
      flows: [flow("alpha", { evaluationHandlers: [{ key: "project", retry }] })],
      modules: [{ key: "lab", evaluationHandlers: [{ key: "formative", retry }] }],
    });

    expect(PlatformRegistry.evaluationHandler("alpha", "project")?.owner).toBe("flow:alpha");
    expect(PlatformRegistry.evaluationHandler("lab", "formative")?.owner).toBe("module:lab");
    expect(PlatformRegistry.evaluationHandler("alpha", "formative")).toBeUndefined();
  });

  it("refuses evaluation handlers under a key shared by two owners", () => {
    const retry = async () => ({ ok: true as const });
    expect(() =>
      PlatformRegistry.install({
        flows: [flow("lab", { evaluationHandlers: [{ key: "project", retry }] })],
        modules: [{ key: "lab", evaluationHandlers: [{ key: "formative", retry }] }],
      })
    ).toThrow(/Evaluation handlers under "lab" are declared by both flow:lab and module:lab/);
  });

  it("refuses a flow config version that cannot be reached from an older one", () => {
    const schema = { parse: (value: unknown) => value as Record<string, unknown> };
    expect(() =>
      PlatformRegistry.install({
        flows: [flow("alpha", { config: { version: 3, schema, upgrades: { 1: (config) => config } } })],
      })
    ).toThrow(/Flow "alpha" config version 3 has no upgrade from version 2/);
    expect(PlatformRegistry.isInstalled()).toBe(false);
  });

  it("refuses a second distribution, and says when none is installed", () => {
    expect(() => PlatformRegistry.flows()).toThrow(/No distribution installed/);

    PlatformRegistry.install(DISTRIBUTION);
    expect(() => PlatformRegistry.install(DISTRIBUTION)).toThrow(/already installed/);
  });
});
