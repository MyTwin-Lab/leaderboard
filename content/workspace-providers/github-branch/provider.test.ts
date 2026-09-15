import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  auths: [] as unknown[],
  octokit: {
    rest: {
      git: { getRef: vi.fn(), createRef: vi.fn(), deleteRef: vi.fn() },
      repos: { updateBranchProtection: vi.fn() },
    },
  },
}));

vi.mock("octokit", () => ({
  Octokit: class {
    constructor(options: { auth: unknown }) {
      h.auths.push(options.auth);
      return h.octokit;
    }
  },
}));

import { MissingConfigurationError } from "../../../packages/provisioner/src/errors.js";
import { GitHubBranchProvider } from "./provider.js";

const notFound = Object.assign(new Error("Not Found"), { status: 404 });

beforeEach(() => {
  vi.clearAllMocks();
  h.auths.length = 0;
});

describe("GitHubBranchProvider — token", () => {
  it("reads the token at every call, so a reconnected GitHub is used right away", async () => {
    const resolveToken = vi.fn().mockResolvedValueOnce("gho_first").mockResolvedValueOnce("gho_second");
    h.octokit.rest.git.getRef.mockResolvedValue({ data: { object: { sha: "abc" } } });
    const provider = new GitHubBranchProvider(resolveToken);

    await provider.getStatus("acme/widgets", "refs/heads/contrib/3-alice");
    await provider.getStatus("acme/widgets", "refs/heads/contrib/3-alice");

    expect(h.auths).toEqual(["gho_first", "gho_second"]);
  });

  it("is available only while a token can be read", async () => {
    expect(await new GitHubBranchProvider(async () => "gho_token").isAvailable()).toBe(true);
    expect(await new GitHubBranchProvider(async () => null).isAvailable()).toBe(false);
  });

  it("refuses to provision or protect without a GitHub connection", async () => {
    const provider = new GitHubBranchProvider(async () => null);

    await expect(
      provider.provision({ workspaceType: "git_branch", parentRef: "acme/widgets", name: "contrib/3-alice" }),
    ).rejects.toThrow(MissingConfigurationError);
    await expect(provider.protect("acme/widgets", "refs/heads/contrib/3-alice", ["alice"])).rejects.toThrow(
      MissingConfigurationError,
    );
    expect(h.auths).toEqual([]);
  });

  it("reports a missing connection as a failed status rather than throwing", async () => {
    expect(await new GitHubBranchProvider(async () => null).getStatus("acme/widgets", "refs/heads/x")).toBe("failed");
  });
});

describe("GitHubBranchProvider — branches", () => {
  const provider = () => new GitHubBranchProvider(async () => "gho_token");

  it("creates the branch from its base when it does not exist yet", async () => {
    h.octokit.rest.git.getRef
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({ data: { object: { sha: "base-sha" } } });
    h.octokit.rest.git.createRef.mockResolvedValue({ data: { object: { sha: "new-sha" } } });

    const result = await provider().provision({
      workspaceType: "git_branch",
      parentRef: "acme/widgets",
      name: "contrib/3-alice",
      baseRef: "challenge/3",
    });

    expect(h.octokit.rest.git.createRef).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      ref: "refs/heads/contrib/3-alice",
      sha: "base-sha",
    });
    expect(result).toMatchObject({ status: "ready", ref: "refs/heads/contrib/3-alice", meta: { baseSha: "base-sha", sha: "new-sha" } });
  });

  it("protects a branch for the given users only", async () => {
    h.octokit.rest.repos.updateBranchProtection.mockResolvedValue({});

    await provider().protect("acme/widgets", "refs/heads/contrib/3-alice", ["alice", "bob"]);

    expect(h.octokit.rest.repos.updateBranchProtection).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", repo: "widgets", branch: "contrib/3-alice", restrictions: { users: ["alice", "bob"], teams: [] } }),
    );
  });
});
