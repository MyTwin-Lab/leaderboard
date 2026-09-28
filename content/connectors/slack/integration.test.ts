import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ fetch: vi.fn(), createConnector: vi.fn() }));
vi.stubGlobal("fetch", h.fetch);
vi.mock("../../../packages/connectors/registry.js", () => ({
  ConnectorRegistry: { createConnector: (...args: unknown[]) => h.createConnector(...args) },
}));

import { slackIntegration } from "./integration.js";

const auth = slackIntegration.auth as Extract<typeof slackIntegration.auth, { kind: "api_key" }>;
const channels = slackIntegration.extras!.find((e) => e.key === "channels")!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slackIntegration.connect", () => {
  it("keeps the token and the workspace name when auth.test succeeds", async () => {
    h.fetch.mockResolvedValue({ json: async () => ({ ok: true, team: "MyTwin" }) });

    expect(await auth.connect({ bot_token: "xoxb-1" })).toEqual({ ok: true, secret: "xoxb-1", meta: { team_name: "MyTwin" } });
    expect(slackIntegration.publicMeta!({ team_name: "MyTwin" })).toEqual([{ label: "Workspace", value: "MyTwin" }]);
  });

  it("reads the failure from the body, Slack answering 200 either way", async () => {
    h.fetch.mockResolvedValue({ json: async () => ({ ok: false, error: "invalid_auth" }) });

    expect(await auth.connect({ bot_token: "bad" })).toEqual({ ok: false, error: "Invalid Slack token (invalid_auth)" });
  });

  it("reports an unreachable Slack API as 502", async () => {
    h.fetch.mockRejectedValue(new Error("down"));

    expect(await auth.connect({ bot_token: "x" })).toEqual({ ok: false, error: "Could not reach Slack API", status: 502 });
  });
});

describe("slackIntegration channels extra", () => {
  it("is open to admins and project managers", () => {
    expect(channels.access).toBe("admin_or_manager");
  });

  it("lists the channels the bot can read", async () => {
    h.createConnector.mockResolvedValue({ listChannels: async () => [{ id: "C1", name: "general" }] });

    expect(await channels.run()).toEqual([{ id: "C1", name: "general" }]);
    expect(h.createConnector).toHaveBeenCalledWith({ type: "slack" });
  });

  it("answers 400 while Slack is not connected, 502 when listing fails", async () => {
    h.createConnector.mockResolvedValueOnce(null);
    expect(((await channels.run()) as Response).status).toBe(400);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.createConnector.mockResolvedValueOnce({ listChannels: async () => { throw new Error("rate limited"); } });
    expect(((await channels.run()) as Response).status).toBe(502);
    spy.mockRestore();
  });
});
