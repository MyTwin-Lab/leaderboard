import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockVerifyRequestToken, mockFindByManagerId, mockIsSlugTaken, mockAvailableSlug } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockFindByManagerId: vi.fn(),
  mockIsSlugTaken: vi.fn(),
  mockAvailableSlug: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock("@/lib/db", () => ({
  repositories: {
    project: { findByManagerId: mockFindByManagerId },
    challenge: { isSlugTaken: mockIsSlugTaken, availableSlug: mockAvailableSlug },
  },
}));

import { GET } from "./route";

function check(query: string) {
  return GET(new NextRequest(`http://localhost/api/challenges/slug-availability${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequestToken.mockResolvedValue({ userId: "admin-1", role: "admin" });
  mockFindByManagerId.mockResolvedValue([]);
  mockIsSlugTaken.mockResolvedValue(false);
  mockAvailableSlug.mockImplementation(async (base: string) => `${base}-2`);
});

describe("GET /api/challenges/slug-availability", () => {
  it("returns 401 without a session", async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    expect((await check("?slug=mykine")).status).toBe(401);
  });

  it("refuses a contributor who manages no project: a taken slug would reveal a draft", async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: "u1", role: "contributor" });
    expect((await check("?slug=mykine")).status).toBe(403);
    expect(mockIsSlugTaken).not.toHaveBeenCalled();
  });

  it("answers a project manager", async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: "u1", role: "contributor" });
    mockFindByManagerId.mockResolvedValue([{ uuid: "p1" }]);
    expect((await check("?slug=mykine")).status).toBe(200);
  });

  it("reports a taken slug with a suggestion", async () => {
    mockIsSlugTaken.mockResolvedValue(true);
    const res = await check("?slug=mykine");
    expect(await res.json()).toMatchObject({ slug: "mykine", available: false, suggestion: "mykine-2" });
  });
});
