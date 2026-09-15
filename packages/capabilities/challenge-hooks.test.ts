import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { Challenge } from "../database-service/domain/entities.js";
import { PlatformRegistry, type ChallengeHooks } from "../registry/platform.js";
import {
  creationRepos,
  flowUses,
  isClosedStatus,
  runCloseHooks,
  runDeleteHooks,
  runGroupJoinHooks,
  runJoinHooks,
} from "./challenge-hooks.js";

const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });

const calls: string[] = [];
const flowHooks: ChallengeHooks = {
  onCreate: ({ challenge, input }) => ({ repos: [{ title: `${challenge.title} — Code`, type: "github", external_repo_id: input.slug as string }] }),
  onJoin: async ({ userId }) => { calls.push(`flow:join:${userId}`); return { branch: "ready" }; },
  onGroupJoin: async ({ groupId }) => { calls.push(`flow:group:${groupId}`); return { missing: [] }; },
  onClose: async () => { calls.push("flow:close"); throw new Error("provider down"); },
  onDelete: async () => { calls.push("flow:delete"); },
};
const extensionHooks: ChallengeHooks = {
  onCreate: () => ({ repos: [{ title: "Notes", type: "github" }] }),
  onJoin: async () => { calls.push("extension:join"); return { branch: "overridden", extra: true }; },
  onClose: async () => { calls.push("extension:close"); },
  onDelete: async () => { calls.push("extension:delete"); throw new Error("cannot release"); },
};

const CHALLENGE = { uuid: "c-1", title: "Build", type: "demo" } as Challenge;

beforeEach(() => {
  calls.length = 0;
  PlatformRegistry.reset();
  PlatformRegistry.install({
    flows: [
      { descriptor: descriptor("demo"), uses: { board: true }, hooks: flowHooks },
      { descriptor: descriptor("other") },
    ],
    extensions: [
      { key: "attached", appliesTo: ["demo"], hooks: extensionHooks },
      { key: "elsewhere", appliesTo: ["other"], hooks: { onJoin: async () => { calls.push("elsewhere:join"); } } },
    ],
  });
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("flowUses", () => {
  it("reads the capabilities a flow declares", () => {
    expect(flowUses("demo", "board")).toBe(true);
    expect(flowUses("demo", "groups")).toBe(false);
    expect(flowUses("other", "board")).toBe(false);
    expect(flowUses("missing", "board")).toBe(false);
  });
});

describe("isClosedStatus", () => {
  it("treats completed and archived as closed", () => {
    expect(isClosedStatus("completed")).toBe(true);
    expect(isClosedStatus("archived")).toBe(true);
    expect(isClosedStatus("active")).toBe(false);
    expect(isClosedStatus(undefined)).toBe(false);
  });
});

describe("creationRepos", () => {
  it("collects the repos of the flow, then of its extensions", () => {
    expect(creationRepos(CHALLENGE, { slug: "acme/app" })).toEqual([
      { title: "Build — Code", type: "github", external_repo_id: "acme/app" },
      { title: "Notes", type: "github" },
    ]);
  });

  it("creates nothing for a flow that is not installed", () => {
    expect(creationRepos({ ...CHALLENGE, type: "missing" })).toEqual([]);
  });
});

describe("runJoinHooks", () => {
  it("runs the flow first, then its extensions, and merges what they report", async () => {
    const report = await runJoinHooks({ challenge: CHALLENGE, userId: "alice", groupId: null });

    expect(calls).toEqual(["flow:join:alice", "extension:join"]);
    expect(report).toEqual({ branch: "overridden", extra: true });
  });

  it("never runs an extension attached to another flow", async () => {
    await runJoinHooks({ challenge: { ...CHALLENGE, type: "other" }, userId: "alice", groupId: null });

    expect(calls).toEqual(["elsewhere:join"]);
  });
});

describe("runGroupJoinHooks", () => {
  it("runs the group hooks that exist", async () => {
    const report = await runGroupJoinHooks({ challenge: CHALLENGE, userId: "bob", groupId: "g-1" });

    expect(calls).toEqual(["flow:group:g-1"]);
    expect(report).toEqual({ missing: [] });
  });
});

describe("runCloseHooks", () => {
  it("keeps going past a failing hook and never throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCloseHooks(CHALLENGE)).resolves.toBeUndefined();

    expect(calls).toEqual(["flow:close", "extension:close"]);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("runDeleteHooks", () => {
  it("lets a failure stop the deletion", async () => {
    await expect(runDeleteHooks(CHALLENGE)).rejects.toThrow("cannot release");

    expect(calls).toEqual(["flow:delete", "extension:delete"]);
  });
});
