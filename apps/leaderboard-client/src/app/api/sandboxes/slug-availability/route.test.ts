import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockVerifyRequestToken, mockIsSlugTaken, mockAvailableSlug } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockIsSlugTaken: vi.fn(),
  mockAvailableSlug: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock("@/lib/db", () => ({
  repositories: { sandbox: { isSlugTaken: mockIsSlugTaken, availableSlug: mockAvailableSlug } },
}));

import { GET } from "./route";

function check(query: string) {
  return GET(new NextRequest(`http://localhost/api/sandboxes/slug-availability${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: "u1", role: "contributor" });
  mockIsSlugTaken.mockResolvedValue(false);
  mockAvailableSlug.mockImplementation(async (base: string) => `${base}-2`);
});

describe("GET /api/sandboxes/slug-availability", () => {
  it("returns 401 without a session — the route is outside the proxy matcher", async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    expect((await check("?slug=mykine")).status).toBe(401);
  });

  it("refuses a viewer, who cannot create a sandbox", async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: "u1", role: "viewer" });
    expect((await check("?slug=mykine")).status).toBe(403);
  });

  it("checks the sandbox namespace, excluding the sandbox being edited", async () => {
    const id = "8e53bee5-27d0-483d-9adf-091e5df9f2e8";
    const res = await check(`?slug=mykine&exclude=${id}`);
    expect(await res.json()).toEqual({ slug: "mykine", available: true, problem: null, suggestion: null });
    expect(mockIsSlugTaken).toHaveBeenCalledWith("mykine", id);
  });
});
