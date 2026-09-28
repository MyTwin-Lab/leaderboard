import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ client: { testConnection: vi.fn() }, clientArgs: [] as unknown[][] }));

vi.mock("./scaleway/index.js", () => ({
  ScalewayClient: class {
    constructor(...args: unknown[]) {
      h.clientArgs.push(args);
      return h.client;
    }
  },
}));

import { purgeScalewaySecretIfSafe, scalewayIntegration } from "./integration.js";

const auth = scalewayIntegration.auth as Extract<typeof scalewayIntegration.auth, { kind: "api_key" }>;

function status(meta: Record<string, unknown>, connected = true) {
  return { connected, meta, connectedAt: null, connectedBy: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.clientArgs.length = 0;
});

describe("scalewayIntegration.connect", () => {
  it("checks the zone with the Scaleway API and keeps project and zone in meta", async () => {
    h.client.testConnection.mockResolvedValue(true);

    const result = await auth.connect({ secret_key: "scw", project_id: "p-1", zone: "fr-par-2" });

    expect(result).toEqual({ ok: true, secret: "scw", meta: { project_id: "p-1", zone: "fr-par-2" } });
    expect(h.clientArgs[0]).toEqual(["scw", "p-1"]);
    expect(h.client.testConnection).toHaveBeenCalledWith("fr-par-2");
  });

  it("refuses rejected credentials, and reports an unreachable API as 502", async () => {
    h.client.testConnection.mockResolvedValueOnce(false);
    expect(await auth.connect({ secret_key: "x", project_id: "p", zone: "z" })).toEqual({
      ok: false,
      error: "Invalid Scaleway credentials or zone",
    });

    h.client.testConnection.mockRejectedValueOnce(new Error("down"));
    expect(await auth.connect({ secret_key: "x", project_id: "p", zone: "z" })).toMatchObject({ ok: false, status: 502 });
  });
});

describe("scalewayIntegration disconnect", () => {
  it("counts as disconnected as soon as the disconnect is requested", () => {
    expect(scalewayIntegration.isConnected!(status({ project_id: "p-1" }))).toBe(true);
    expect(scalewayIntegration.isConnected!(status({ disconnect_requested_at: "2026-09-15T10:00:00Z" }))).toBe(false);
  });

  it("only flags the disconnect, keeping the secret for instances still running", async () => {
    const credentials = { patchMeta: vi.fn(), remove: vi.fn() };

    await scalewayIntegration.disconnect!(credentials as any);

    expect(credentials.patchMeta).toHaveBeenCalledWith("scaleway", { disconnect_requested_at: expect.any(String) });
    expect(credentials.remove).not.toHaveBeenCalled();
  });
});

describe("purgeScalewaySecretIfSafe", () => {
  it("does nothing without a pending disconnect", async () => {
    const credentials = { status: vi.fn(async () => status({ project_id: "p" })), remove: vi.fn() };
    const countActiveRequests = vi.fn();

    expect(await purgeScalewaySecretIfSafe({ credentials, countActiveRequests })).toBe(false);
    expect(countActiveRequests).not.toHaveBeenCalled();
    expect(credentials.remove).not.toHaveBeenCalled();
  });

  it("keeps the secret while a request is still active", async () => {
    const credentials = { status: vi.fn(async () => status({ disconnect_requested_at: "x" })), remove: vi.fn() };

    expect(await purgeScalewaySecretIfSafe({ credentials, countActiveRequests: async () => 1 })).toBe(false);
    expect(credentials.remove).not.toHaveBeenCalled();
  });

  it("removes the connection once nothing is running anymore", async () => {
    const credentials = { status: vi.fn(async () => status({ disconnect_requested_at: "x" })), remove: vi.fn(async () => true) };

    expect(await purgeScalewaySecretIfSafe({ credentials, countActiveRequests: async () => 0 })).toBe(true);
    expect(credentials.remove).toHaveBeenCalledWith("scaleway");
  });
});
