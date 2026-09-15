import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  signalRepo: { findByChallenge: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  slackConfigRepo: { findByChallenge: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../packages/database-service/repositories/index.js", () => ({
  ChallengeSignalRepository: class {
    constructor() {
      return h.signalRepo;
    }
  },
  ChallengeSlackConfigRepository: class {
    constructor() {
      return h.slackConfigRepo;
    }
  },
}));

import { actionContext } from "../../../packages/capabilities/testing/action-context.js";
import { createSignal, deleteConfig, deleteSignal, getConfig, listSignals, saveConfig, updateSignal } from "./actions.js";
import { slackSignalsExtension } from "./index.js";

const CHALLENGE_ID = "challenge-1";
const SIGNAL_ID = "signal-1";

const ctx = (options: Parameters<typeof actionContext>[0] = {}) =>
  actionContext({ challenge: { uuid: CHALLENGE_ID }, user: { id: "admin-1", role: "admin" }, ...options });

async function read(result: unknown): Promise<{ status: number; body: unknown }> {
  if (result instanceof Response) return { status: result.status, body: await result.json() };
  return { status: 200, body: result };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.signalRepo.findById.mockResolvedValue({ uuid: SIGNAL_ID, challenge_id: CHALLENGE_ID, label: "Old label" });
});

describe("slack-signals extension — declared access", () => {
  const access = (method: string, path: string) =>
    slackSignalsExtension.actions?.find((a) => a.method === method && a.path === path)?.access;

  it("lets any signed-in account read the challenge's signals", () => {
    expect(access("GET", "signals")).toEqual({});
  });

  it.each([
    ["POST", "signals"],
    ["PUT", "signals/:signalId"],
    ["DELETE", "signals/:signalId"],
    ["GET", "config"],
    ["PUT", "config"],
    ["DELETE", "config"],
  ])("keeps %s %s to an admin or the challenge's manager", (method, path) => {
    expect(access(method, path)).toEqual({ roles: ["admin"], manager: true });
  });
});

describe("GET signals", () => {
  it("returns the signals for the challenge", async () => {
    h.signalRepo.findByChallenge.mockResolvedValue([{ uuid: "s1", label: "Signal 1" }]);

    expect(await listSignals(ctx())).toEqual([{ uuid: "s1", label: "Signal 1" }]);
    expect(h.signalRepo.findByChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
  });
});

describe("POST signals", () => {
  const post = (body: unknown) => createSignal(ctx({ method: "POST", body }));

  it("creates a signal on this challenge", async () => {
    h.signalRepo.create.mockResolvedValue({ uuid: "s1", challenge_id: CHALLENGE_ID, label: "New signal", reward_cp: 5 });

    const { status } = await read(await post({ label: "New signal", reward_cp: 5 }));

    expect(status).toBe(201);
    expect(h.signalRepo.create).toHaveBeenCalledWith({
      challenge_id: CHALLENGE_ID,
      label: "New signal",
      description: undefined,
      reward_cp: 5,
      icon: null,
      position: 0,
    });
  });

  it("returns 400 on invalid body (Zod)", async () => {
    expect((await read(await post({ label: "", reward_cp: 5 }))).status).toBe(400);
    expect(h.signalRepo.create).not.toHaveBeenCalled();
  });

  it("returns 400 when reward_cp is missing", async () => {
    expect((await read(await post({ label: "New signal" }))).status).toBe(400);
  });
});

describe("PUT signals/:signalId", () => {
  const put = (body: unknown) => updateSignal(ctx({ method: "PUT", body, params: { signalId: SIGNAL_ID } }));

  it("updates the signal", async () => {
    h.signalRepo.update.mockResolvedValue({ uuid: SIGNAL_ID, challenge_id: CHALLENGE_ID, label: "New label" });

    expect(await put({ label: "New label" })).toEqual({ uuid: SIGNAL_ID, challenge_id: CHALLENGE_ID, label: "New label" });
    expect(h.signalRepo.update).toHaveBeenCalledWith(SIGNAL_ID, { label: "New label" });
  });

  it("returns 404 when the signal does not exist", async () => {
    h.signalRepo.findById.mockResolvedValue(null);

    expect((await read(await put({ label: "New label" }))).status).toBe(404);
    expect(h.signalRepo.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the signal belongs to a different challenge", async () => {
    h.signalRepo.findById.mockResolvedValue({ uuid: SIGNAL_ID, challenge_id: "other-challenge" });

    expect(await read(await put({ label: "New label" }))).toEqual({ status: 404, body: { error: "Signal not found" } });
    expect(h.signalRepo.update).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body (Zod)", async () => {
    expect((await read(await put({ reward_cp: -1 }))).status).toBe(400);
    expect(h.signalRepo.update).not.toHaveBeenCalled();
  });
});

describe("DELETE signals/:signalId", () => {
  const del = () => deleteSignal(ctx({ method: "DELETE", params: { signalId: SIGNAL_ID } }));

  it("deletes the signal", async () => {
    h.signalRepo.delete.mockResolvedValue(undefined);

    expect(await del()).toEqual({ success: true });
    expect(h.signalRepo.delete).toHaveBeenCalledWith(SIGNAL_ID);
  });

  it("returns 404 when the signal does not exist", async () => {
    h.signalRepo.findById.mockResolvedValue(null);

    expect((await read(await del())).status).toBe(404);
    expect(h.signalRepo.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the signal belongs to a different challenge", async () => {
    h.signalRepo.findById.mockResolvedValue({ uuid: SIGNAL_ID, challenge_id: "other-challenge" });

    expect((await read(await del())).status).toBe(404);
    expect(h.signalRepo.delete).not.toHaveBeenCalled();
  });
});

describe("config", () => {
  it("returns the challenge's Slack config", async () => {
    h.slackConfigRepo.findByChallenge.mockResolvedValue({ challenge_id: CHALLENGE_ID, channel_id: "C123" });

    expect(await getConfig(ctx())).toEqual({ challenge_id: CHALLENGE_ID, channel_id: "C123" });
    expect(h.slackConfigRepo.findByChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it("upserts the config", async () => {
    h.slackConfigRepo.upsert.mockResolvedValue({ challenge_id: CHALLENGE_ID, channel_id: "C123", channel_name: "general" });

    await saveConfig(ctx({ method: "PUT", body: { channel_id: "C123", channel_name: "general" } }));

    expect(h.slackConfigRepo.upsert).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, channel_id: "C123", channel_name: "general" });
  });

  it("defaults channel_name to null when omitted", async () => {
    h.slackConfigRepo.upsert.mockResolvedValue({ challenge_id: CHALLENGE_ID, channel_id: "C123", channel_name: null });

    await saveConfig(ctx({ method: "PUT", body: { channel_id: "C123" } }));

    expect(h.slackConfigRepo.upsert).toHaveBeenCalledWith({ challenge_id: CHALLENGE_ID, channel_id: "C123", channel_name: null });
  });

  it("returns 400 on invalid body (Zod)", async () => {
    expect((await read(await saveConfig(ctx({ method: "PUT", body: { channel_id: "" } })))).status).toBe(400);
    expect(h.slackConfigRepo.upsert).not.toHaveBeenCalled();
  });

  it("deletes the config", async () => {
    h.slackConfigRepo.delete.mockResolvedValue(undefined);

    expect(await deleteConfig(ctx({ method: "DELETE" }))).toEqual({ success: true });
    expect(h.slackConfigRepo.delete).toHaveBeenCalledWith(CHALLENGE_ID);
  });
});
