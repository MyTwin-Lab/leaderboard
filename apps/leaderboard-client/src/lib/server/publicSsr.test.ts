import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { cookieNames } = vi.hoisted(() => ({ cookieNames: { current: [] as string[] } }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ has: (name: string) => cookieNames.current.includes(name) }),
}));

import { isCookielessVisitor, readPublicRoute } from "./publicSsr";

describe("isCookielessVisitor", () => {
  it("is true for a visitor without any identity cookie, like a crawler", async () => {
    cookieNames.current = ["some_unrelated_cookie"];
    expect(await isCookielessVisitor()).toBe(true);
  });

  it.each(["access_token", "refresh_token", "sb_anon"])("is false as soon as %s is present", async (name) => {
    cookieNames.current = [name];
    expect(await isCookielessVisitor()).toBe(false);
  });
});

describe("readPublicRoute", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the route without any cookie, with its params, and returns its JSON", async () => {
    const handler = vi.fn(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
      Response.json({ id: (await params).id, cookie: request.headers.get("cookie") }),
    );

    const data = await readPublicRoute(handler, "/api/sandboxes/s1", { id: "s1" });

    expect(data).toEqual({ id: "s1", cookie: null });
    expect(handler.mock.calls[0][0].nextUrl.pathname).toBe("/api/sandboxes/s1");
  });

  it("returns null when the route refuses, so the page falls back to client loading", async () => {
    const handler = async () => Response.json({ error: "Challenge not found" }, { status: 404 });

    expect(await readPublicRoute(handler, "/api/challenges/draft/overview")).toBeNull();
  });

  it("returns null instead of failing the page when the route throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = async (): Promise<Response> => {
      throw new Error("database unavailable");
    };

    expect(await readPublicRoute(handler, "/api/sandboxes")).toBeNull();
  });
});
