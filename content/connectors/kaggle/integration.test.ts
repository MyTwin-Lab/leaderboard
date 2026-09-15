import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.stubGlobal("fetch", h.fetch);

import { kaggleIntegration } from "./integration.js";

const auth = kaggleIntegration.auth as Extract<typeof kaggleIntegration.auth, { kind: "api_key" }>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("kaggleIntegration", () => {
  it("checks the credentials against Kaggle with basic auth, then keeps the username in meta", async () => {
    h.fetch.mockResolvedValue({ ok: true });

    const result = await auth.connect({ username: "ada", api_key: "k" });

    expect(result).toEqual({ ok: true, secret: "k", meta: { username: "ada" } });
    const [url, init] = h.fetch.mock.calls[0];
    expect(url).toContain("user=ada");
    expect(init.headers.Authorization).toBe("Basic " + Buffer.from("ada:k").toString("base64"));
    expect(kaggleIntegration.publicMeta!({ username: "ada" })).toEqual([{ label: "Username", value: "ada" }]);
  });

  it("refuses credentials Kaggle rejects, and reports an unreachable API as 502", async () => {
    h.fetch.mockResolvedValueOnce({ ok: false });
    expect(await auth.connect({ username: "ada", api_key: "bad" })).toEqual({ ok: false, error: "Invalid Kaggle credentials" });

    h.fetch.mockRejectedValueOnce(new Error("down"));
    expect(await auth.connect({ username: "ada", api_key: "k" })).toEqual({ ok: false, error: "Could not reach Kaggle API", status: 502 });
  });
});
