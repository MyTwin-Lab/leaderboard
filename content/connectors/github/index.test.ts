import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ getGithubToken: vi.fn() }));

vi.mock("../../../packages/config/githubToken.js", () => ({ getGithubToken: h.getGithubToken }));

import { githubConnector, GitHubExternalConnector } from "./index.js";

describe("githubConnector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("builds a connector for an owner/repo reference when a token is available", async () => {
    h.getGithubToken.mockResolvedValue("gh-token");

    const connector = await githubConnector.create({ type: "github", external_repo_id: "acme/widgets" }, { branch: "main" });

    expect(connector).toBeInstanceOf(GitHubExternalConnector);
    expect(connector?.authConfig).toEqual({ token: "gh-token" });
  });

  it("is not built without a token unless the caller accepts anonymous access", async () => {
    h.getGithubToken.mockResolvedValue(null);

    expect(await githubConnector.create({ type: "github", external_repo_id: "acme/widgets" })).toBeNull();

    const anonymous = await githubConnector.create(
      { type: "github", external_repo_id: "acme/widgets" },
      { allowAnonymous: true }
    );
    expect(anonymous).toBeInstanceOf(GitHubExternalConnector);
    expect(anonymous?.authConfig).toEqual({ token: undefined });
  });

  it("refuses a missing or malformed reference before reading any token", async () => {
    expect(await githubConnector.create({ type: "github" })).toBeNull();
    expect(await githubConnector.create({ type: "github", external_repo_id: "widgets" })).toBeNull();
    expect(h.getGithubToken).not.toHaveBeenCalled();
  });
});
