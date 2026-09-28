import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  config: {
    githubOAuth: {
      clientId: "Iv1.test" as string | undefined,
      clientSecret: "secret",
      redirectUri: "http://localhost:3000/api/github-oauth/callback" as string | undefined,
    },
  },
  fetch: vi.fn(),
}));

vi.mock("../../../packages/config/index.js", () => ({ config: h.config }));
vi.stubGlobal("fetch", h.fetch);

import { githubIntegration } from "./integration.js";

const auth = githubIntegration.auth as Extract<typeof githubIntegration.auth, { kind: "oauth" }>;
const jsonResponse = (body: unknown) => ({ json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  h.config.githubOAuth.clientId = "Iv1.test";
  h.config.githubOAuth.redirectUri = "http://localhost:3000/api/github-oauth/callback";
});

describe("githubIntegration.authorize", () => {
  it("builds the GitHub authorize URL with the repo and org scopes", () => {
    const target = auth.authorize({ state: "abc" });

    expect("url" in target).toBe(true);
    const url = new URL((target as { url: string }).url);
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("Iv1.test");
    expect(url.searchParams.get("scope")).toBe("repo read:org");
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("reports an unconfigured OAuth app", () => {
    h.config.githubOAuth.clientId = undefined;

    expect(auth.authorize({ state: "abc" })).toEqual({ error: "GitHub OAuth not configured" });
  });
});

describe("githubIntegration.callback", () => {
  it("fails the exchange when the token request throws or has no token", async () => {
    h.fetch.mockRejectedValueOnce(new Error("network down"));
    expect(await auth.callback({ code: "c" })).toEqual({ ok: false, error: "exchange_failed" });

    h.fetch.mockResolvedValueOnce(jsonResponse({ error: "bad_verification_code" }));
    expect(await auth.callback({ code: "c" })).toEqual({ ok: false, error: "exchange_failed" });
  });

  it("fails the exchange when the membership request throws", async () => {
    h.fetch.mockResolvedValueOnce(jsonResponse({ access_token: "gh-token" })).mockRejectedValueOnce(new Error("down"));

    expect(await auth.callback({ code: "c" })).toEqual({ ok: false, error: "exchange_failed" });
  });

  it("refuses an account that administers no organization", async () => {
    h.fetch
      .mockResolvedValueOnce(jsonResponse({ access_token: "gh-token" }))
      .mockResolvedValueOnce(jsonResponse([{ state: "active", role: "member", organization: { login: "SomeOrg" } }]));

    expect(await auth.callback({ code: "c" })).toEqual({ ok: false, error: "no_org_admin" });
  });

  it("keeps the token and the first active admin organization alphabetically", async () => {
    h.fetch
      .mockResolvedValueOnce(jsonResponse({ access_token: "gh-token" }))
      .mockResolvedValueOnce(jsonResponse([
        { state: "active", role: "owner", organization: { login: "ZOrg" } },
        { state: "active", role: "admin", organization: { login: "AOrg" } },
        { state: "inactive", role: "admin", organization: { login: "NopeOrg" } },
      ]));

    expect(await auth.callback({ code: "c" })).toEqual({ ok: true, secret: "gh-token", meta: { org: "AOrg" } });
    expect(githubIntegration.publicMeta!({ org: "AOrg" })).toEqual([{ label: "Organization", value: "AOrg" }]);
  });
});
