import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { z } from "zod";
import type { Challenge } from "../database-service/domain/entities.js";
import { PlatformRegistry, type ExtensionDefinition, type FlowDefinition } from "./platform.js";
import { dispatchChallengeAction, type ActionDispatchDeps } from "../capabilities/challenge-actions.js";
import { creationRepos, flowUses, runJoinHooks } from "../capabilities/challenge-hooks.js";
import { FlowConfigError, flowConfigOf, parseFlowRules, prepareFlowConfig } from "../capabilities/flow-config.js";

/**
 * Un flow d'exemple, jetable et hors distribution (challenge 020, fin de L7)
 * --------------------------------------------------------------------------
 * Tout ce qu'un nouveau workflow apporte tient dans ses déclarations : il
 * s'installe dans un manifeste de test, sans aucune modification du core ni
 * du schéma, et le core le sert — configuration versionnée, règles, actions
 * avec leur accès, hooks, jobs, clés de ledger, extension attachée.
 */

const exampleFlow: FlowDefinition = {
  descriptor: {
    key: "example",
    label: "Example",
    longLabel: "Example challenge",
    icon: "sparkles",
    briefRequired: false,
    publiclyVisible: false,
  },
  config: {
    version: 2,
    schema: z.object({ limit: z.number().int().min(1).default(3) }),
    // La version 1 appelait la limite `max`.
    upgrades: { 1: ({ max, ...rest }) => ({ ...rest, limit: max }) },
  },
  rules: {
    parse: (raw) =>
      raw && typeof raw === "object" && typeof (raw as { per_entry?: unknown }).per_entry === "number" ? raw : null,
  },
  ruleKeys: [{ key: "example_entry", consumesPool: true, label: "Entry" }],
  contributionTypes: [{ key: "example_entry", countsAsContribution: true }],
  uses: { board: true },
  hooks: {
    onCreate: ({ challenge, input }) => ({
      repos: [{ title: `${challenge.title} — Workspace`, type: "github", external_repo_id: input.repo as string }],
    }),
    onJoin: async ({ userId }) => ({ welcomed: userId }),
  },
  actions: [
    {
      path: "entries",
      method: "POST",
      access: { member: true },
      async handle({ request, challenge, user }) {
        const body = (await request.json()) as { title: string };
        return Response.json({ created: body.title, by: user.id, limit: flowConfigOf(challenge)?.limit }, { status: 201 });
      },
    },
  ],
  jobs: [{ key: "example.cleanup", schedule: "0 3 * * *", run: async () => ({ cleaned: 0 }) }],
};

const notesExtension: ExtensionDefinition = {
  key: "notes",
  appliesTo: ["example"],
  config: { schema: z.object({ enabled: z.boolean().default(false) }), editableKeys: ["enabled"] },
  actions: [{ path: "notes", method: "GET", access: {}, handle: async () => ({ notes: [] }) }],
};

const CHALLENGE = {
  uuid: "11111111-1111-4111-8111-111111111111",
  title: "Example",
  slug: "example",
  status: "active",
  type: "example",
  contribution_points_reward: 100,
  completion: 0,
  project_id: "project-1",
  flow_config: { limit: 3 },
  flow_config_version: 2,
} as Challenge;

function deps(member: boolean): ActionDispatchDeps {
  return {
    findChallenge: async () => CHALLENGE,
    isManager: async () => false,
    isMember: async () => member,
    holds: async () => false,
  };
}

function post(path: string, body: unknown) {
  return new Request(`http://localhost/api/challenges/${CHALLENGE.uuid}/flow/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  PlatformRegistry.reset();
  PlatformRegistry.install({ flows: [exampleFlow], extensions: [notesExtension] });
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("an example flow installed without touching the core", () => {
  it("prepares its configuration with its extension's section, in the current version", () => {
    const stored = prepareFlowConfig("example", { limit: 4, extensions: { notes: { enabled: true } } });

    expect(stored.flow_config_version).toBe(2);
    expect(stored.flow_config).toMatchObject({ limit: 4, extensions: { notes: { enabled: true } } });
    expect(() => prepareFlowConfig("example", { limit: 0 })).toThrow(FlowConfigError);
  });

  it("upgrades a configuration written in an older version when it is read", () => {
    expect(flowConfigOf({ type: "example", flow_config: { max: 5 }, flow_config_version: 1 })?.limit).toBe(5);
  });

  it("parses its reward rules with its own parser", () => {
    expect(parseFlowRules("example", { per_entry: 10 })).toEqual({ ok: true, rules: { per_entry: 10 } });
    expect(parseFlowRules("example", { foo: 1 })).toEqual({ ok: false });
  });

  it("serves its action through the dispatcher, with the access it declares", async () => {
    const refused = await dispatchChallengeAction(
      { request: post("entries", { title: "First" }), challengeId: CHALLENGE.uuid, scope: { kind: "flow" }, segments: ["entries"], user: { id: "alice", role: "contributor" } },
      deps(false),
    );
    const accepted = await dispatchChallengeAction(
      { request: post("entries", { title: "First" }), challengeId: CHALLENGE.uuid, scope: { kind: "flow" }, segments: ["entries"], user: { id: "alice", role: "contributor" } },
      deps(true),
    );

    expect(refused.status).toBe(403);
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toEqual({ created: "First", by: "alice", limit: 3 });
  });

  it("serves the action of an extension attached to it", async () => {
    const res = await dispatchChallengeAction(
      {
        request: new Request("http://localhost/api"),
        challengeId: CHALLENGE.uuid,
        scope: { kind: "extension", key: "notes" },
        segments: ["notes"],
        user: { id: "alice", role: "contributor" },
      },
      deps(false),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notes: [] });
  });

  it("runs its creation and join hooks, and turns on the capabilities it uses", async () => {
    expect(creationRepos(CHALLENGE, { repo: "acme/example" })).toEqual([
      { title: "Example — Workspace", type: "github", external_repo_id: "acme/example" },
    ]);
    expect(await runJoinHooks({ challenge: CHALLENGE, userId: "alice", groupId: null })).toEqual({ welcomed: "alice" });
    expect(flowUses("example", "board")).toBe(true);
    expect(flowUses("example", "groups")).toBe(false);
  });

  it("declares its ledger key and its job to the platform", () => {
    expect(PlatformRegistry.ruleKey("example_entry")).toMatchObject({ consumesPool: true, owner: "flow:example" });
    expect(PlatformRegistry.jobs().map((job) => [job.key, job.owner])).toEqual([["example.cleanup", "flow:example"]]);
  });
});
