import { describe, it, expect, vi } from "vitest";
import { parseGitHubUrl, resolveGitHubCommitShas, type GitHubCommitSource } from "./githubUrl.js";

function source(overrides: Partial<GitHubCommitSource> = {}): GitHubCommitSource {
  return {
    fetchItems: vi.fn(async () => [
      { id: "sha-b", name: "b", type: "commit" },
      { id: "sha-a", name: "a", type: "commit" },
    ]),
    ...overrides,
  };
}

describe("resolveGitHubCommitShas", () => {
  it("returns the single SHA of a commit link without reading the connector", async () => {
    const connector = source();
    const parsed = parseGitHubUrl("https://github.com/acme/widgets/commit/abc123")!;

    expect(await resolveGitHubCommitShas(parsed, connector, 20)).toEqual(["abc123"]);
    expect(connector.fetchItems).not.toHaveBeenCalled();
  });

  it("reads the branch commits from the connector", async () => {
    const connector = source();
    const parsed = parseGitHubUrl("https://github.com/acme/widgets/tree/main")!;

    expect(await resolveGitHubCommitShas(parsed, connector, 20)).toEqual(["sha-b", "sha-a"]);
    expect(connector.fetchItems).toHaveBeenCalledWith({ maxCommits: 20 });
  });

  it("delegates a pull request to the connector", async () => {
    const listPullRequestCommits = vi.fn(async () => ["pr-1", "pr-2"]);
    const parsed = parseGitHubUrl("https://github.com/acme/widgets/pull/42")!;

    expect(await resolveGitHubCommitShas(parsed, source({ listPullRequestCommits }), 5)).toEqual(["pr-1", "pr-2"]);
    expect(listPullRequestCommits).toHaveBeenCalledWith(42, 5);
  });

  it("fails clearly when the connector cannot list pull request commits", async () => {
    const parsed = parseGitHubUrl("https://github.com/acme/widgets/pull/42")!;

    await expect(resolveGitHubCommitShas(parsed, source(), 5)).rejects.toThrow(/cannot list pull request commits/);
  });
});
