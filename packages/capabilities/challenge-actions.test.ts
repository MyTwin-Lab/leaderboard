import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { Challenge } from "../database-service/domain/entities.js";
import { PlatformRegistry, type ActionContext, type PlatformDefinitions } from "../registry/platform.js";
import { dispatchChallengeAction, matchActionPath, type ActionDispatchDeps, type ActionScope } from "./challenge-actions.js";

const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });

const handled: ActionContext[] = [];
const remember = (result: unknown) => async (ctx: ActionContext) => {
  handled.push(ctx);
  return result;
};

const testPlatform: PlatformDefinitions = {
  flows: [
    {
      descriptor: descriptor("demo"),
      actions: [
        { path: "items", method: "GET", access: {}, handle: remember({ items: [] }) },
        { path: "items", method: "POST", access: { roles: ["admin"], manager: true }, handle: remember({ created: true }) },
        { path: "items/:itemId/review", method: "POST", access: { qualification: (c) => (c.flow_config?.reviewer as string) ?? null }, handle: remember({ reviewed: true }) },
        { path: "board", method: "GET", access: { member: true }, handle: remember({ board: [] }) },
        { path: "file", method: "GET", access: {}, handle: async () => new Response("bytes", { status: 200, headers: { "Content-Type": "image/png" } }) },
        { path: "broken", method: "GET", access: {}, handle: async () => { throw new Error("boom"); } },
      ],
    },
    { descriptor: descriptor("other") },
  ],
  extensions: [
    { key: "extra", appliesTo: ["demo"], actions: [{ path: "ping", method: "GET", access: {}, handle: remember({ pong: true }) }] },
    { key: "elsewhere", appliesTo: ["other"], actions: [{ path: "ping", method: "GET", access: {}, handle: remember({ pong: true }) }] },
  ],
};

const CHALLENGE = {
  uuid: "challenge-1", title: "Demo", slug: "demo", status: "active", type: "demo",
  contribution_points_reward: 100, completion: 0, project_id: "project-1",
  flow_config: { reviewer: "medical_pro" },
} as Challenge;

function makeDeps(over: Partial<ActionDispatchDeps> = {}): ActionDispatchDeps {
  return {
    findChallenge: vi.fn(async (id: string) => (id === CHALLENGE.uuid ? CHALLENGE : null)),
    isManager: vi.fn(async () => false),
    isMember: vi.fn(async () => false),
    holds: vi.fn(async () => false),
    ...over,
  };
}

function dispatch(
  path: string,
  options: { method?: string; user?: { id: string; role: string } | null; scope?: ActionScope; challengeId?: string } = {},
  deps = makeDeps(),
) {
  return dispatchChallengeAction(
    {
      request: new Request("http://localhost/api", { method: options.method ?? "GET" }),
      challengeId: options.challengeId ?? CHALLENGE.uuid,
      scope: options.scope ?? { kind: "flow" },
      segments: path.split("/"),
      user: options.user === undefined ? { id: "user-1", role: "contributor" } : options.user,
    },
    deps,
  );
}

beforeEach(() => {
  handled.length = 0;
  PlatformRegistry.reset();
  PlatformRegistry.install(testPlatform);
});

afterAll(() => {
  PlatformRegistry.reset();
});

describe("matchActionPath", () => {
  it("captures the named segments of a matching path", () => {
    expect(matchActionPath("items/:itemId/review", ["items", "i-1", "review"])).toEqual({ itemId: "i-1" });
    expect(matchActionPath("items", ["items"])).toEqual({});
  });

  it("refuses a path of another length or with another literal", () => {
    expect(matchActionPath("items/:itemId", ["items"])).toBeNull();
    expect(matchActionPath("items/:itemId/review", ["items", "i-1", "claim"])).toBeNull();
  });
});

describe("dispatchChallengeAction", () => {
  it("calls the flow's action and sends its result as JSON", async () => {
    const res = await dispatch("items");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
    expect(handled[0].challenge).toBe(CHALLENGE);
    expect(handled[0].user).toEqual({ id: "user-1", role: "contributor" });
  });

  it("passes a Response through untouched, a file for instance", async () => {
    const res = await dispatch("file");

    expect(res.headers.get("content-type")).toBe("image/png");
    expect(await res.text()).toBe("bytes");
  });

  it("gives the handler the named segments of the path", async () => {
    const deps = makeDeps({ holds: vi.fn(async () => true) });

    await dispatch("items/item-9/review", { method: "POST" }, deps);

    expect(handled[0].params).toEqual({ itemId: "item-9" });
  });

  it("answers 404 for an unknown challenge, before anything else", async () => {
    const res = await dispatch("items", { challengeId: "missing", user: null });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Challenge not found" });
  });

  it("answers 404 when the challenge's flow is not installed", async () => {
    const deps = makeDeps({ findChallenge: vi.fn(async () => ({ ...CHALLENGE, type: "retired" })) });

    const res = await dispatch("items", {}, deps);

    expect(res.status).toBe(404);
  });

  it("answers 404 for a path the flow does not declare", async () => {
    expect((await dispatch("nothing/here")).status).toBe(404);
  });

  it("answers 405 with the allowed methods when only the method differs", async () => {
    const res = await dispatch("items", { method: "DELETE" });

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, POST");
  });

  it("answers 401 without a caller", async () => {
    const res = await dispatch("items", { user: null });

    expect(res.status).toBe(401);
    expect(handled).toEqual([]);
  });

  it("answers 403 when none of the declared conditions holds", async () => {
    const res = await dispatch("items", { method: "POST" });

    expect(res.status).toBe(403);
    expect(handled).toEqual([]);
  });

  it("lets through on a single condition: a declared role", async () => {
    const res = await dispatch("items", { method: "POST", user: { id: "admin-1", role: "admin" } });

    expect(res.status).toBe(200);
  });

  it("lets through on a single condition: the challenge's manager", async () => {
    const deps = makeDeps({ isManager: vi.fn(async () => true) });

    const res = await dispatch("items", { method: "POST" }, deps);

    expect(res.status).toBe(200);
    expect(deps.isManager).toHaveBeenCalledWith("user-1", CHALLENGE);
  });

  it("checks membership on the challenge", async () => {
    const refused = await dispatch("board");
    const deps = makeDeps({ isMember: vi.fn(async () => true) });
    const allowed = await dispatch("board", {}, deps);

    expect(refused.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(deps.isMember).toHaveBeenCalledWith("user-1", CHALLENGE.uuid);
  });

  it("checks the qualification the challenge's configuration requires", async () => {
    const deps = makeDeps({ holds: vi.fn(async (_userId: string, key: string) => key === "medical_pro") });

    const res = await dispatch("items/item-1/review", { method: "POST" }, deps);

    expect(res.status).toBe(200);
    expect(deps.holds).toHaveBeenCalledWith("user-1", "medical_pro");
  });

  it("reads each authorization once, shared with the handler", async () => {
    const deps = makeDeps({ isManager: vi.fn(async () => true) });

    await dispatch("items", { method: "POST" }, deps);
    await handled[0].access.isManager();

    expect(deps.isManager).toHaveBeenCalledTimes(1);
  });

  it("answers 500 without leaking the error when the handler throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await dispatch("broken");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Action failed" });
    spy.mockRestore();
  });

  it("dispatches an extension's action on a flow it applies to", async () => {
    const res = await dispatch("ping", { scope: { kind: "extension", key: "extra" } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
  });

  it("answers 404 for an extension that does not apply to the challenge's flow", async () => {
    const res = await dispatch("ping", { scope: { kind: "extension", key: "elsewhere" } });

    expect(res.status).toBe(404);
    expect(handled).toEqual([]);
  });
});

describe("PlatformRegistry — actions", () => {
  it("refuses two actions answering the same call", () => {
    PlatformRegistry.reset();

    expect(() =>
      PlatformRegistry.install({
        flows: [
          {
            descriptor: descriptor("demo"),
            actions: [
              { path: "items/:id", method: "GET", access: {}, handle: async () => null },
              { path: "items/:itemId", method: "GET", access: {}, handle: async () => null },
            ],
          },
        ],
      }),
    ).toThrow('Action "GET items/:itemId" is declared twice by flow:demo');
    expect(PlatformRegistry.isInstalled()).toBe(false);
  });

  it("refuses a path with a leading slash", () => {
    PlatformRegistry.reset();

    expect(() =>
      PlatformRegistry.install({
        flows: [{ descriptor: descriptor("demo"), actions: [{ path: "/items", method: "GET", access: {}, handle: async () => null }] }],
      }),
    ).toThrow('must not start or end with "/"');
  });
});
