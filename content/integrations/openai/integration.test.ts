import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.stubGlobal("fetch", h.fetch);

import { openaiIntegration } from "./integration.js";

const auth = openaiIntegration.auth as Extract<typeof openaiIntegration.auth, { kind: "api_key" }>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("openaiIntegration", () => {
  it("checks the key by listing the models", async () => {
    h.fetch.mockResolvedValue({ ok: true });

    expect(await auth.connect({ api_key: "sk-1" })).toEqual({ ok: true, secret: "sk-1" });
    expect(h.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer sk-1");
  });

  it("refuses a rejected key, and reports an unreachable API as 502", async () => {
    h.fetch.mockResolvedValueOnce({ ok: false });
    expect(await auth.connect({ api_key: "bad" })).toEqual({ ok: false, error: "Invalid OpenAI API key" });

    h.fetch.mockRejectedValueOnce(new Error("down"));
    expect(await auth.connect({ api_key: "sk-1" })).toEqual({ ok: false, error: "Could not reach OpenAI API", status: 502 });
  });
});
