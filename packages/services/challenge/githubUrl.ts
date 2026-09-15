import type { ExternalItem } from "../../connectors/interfaces.js";

/**
 * Parsing of arbitrary GitHub URLs pasted by an admin (repo root, branch,
 * commit, or pull request link) — as opposed to `artifactUrl.ts`, which
 * normalizes/dedupes URLs already tied to a registered contribution.
 */

export interface ParsedGitHubRef {
  owner: string;
  repo: string;
  /** Branch name or commit SHA, when the URL pins one. */
  ref?: string;
  refType: "branch" | "commit" | "pr" | "default";
  prNumber?: number;
}

/**
 * What the resolution needs from the installed GitHub connector: its commits,
 * and the commits of a pull request. Described here rather than imported, so
 * this module does not depend on the connector implementation.
 */
export interface GitHubCommitSource {
  fetchItems(options?: { maxCommits?: number }): Promise<ExternalItem[]>;
  listPullRequestCommits?(prNumber: number, maxCommits: number): Promise<string[]>;
}

/**
 * Supports: `owner/repo` (default branch), `github.com/owner/repo[.git]`,
 * `.../tree/<branch>`, `.../commit/<sha>`, `.../pull/<n>`. Anything else
 * under a recognized repo (issues, blob, etc.) falls back to the default
 * branch rather than failing outright.
 */
export function parseGitHubUrl(raw: string): ParsedGitHubRef | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  // Bare "owner/repo", no host.
  if (/^[^\s/]+\/[^\s/]+$/.test(trimmed)) {
    const [owner, repoRaw] = trimmed.split("/");
    return { owner, repo: repoRaw.replace(/\.git$/, ""), refType: "default" };
  }

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const [owner, repoRaw, kind, ...rest] = segments;
  if (!owner || !repoRaw) return null;
  const repo = repoRaw.replace(/\.git$/, "");

  if (!kind) return { owner, repo, refType: "default" };

  if (kind === "tree" && rest.length > 0) {
    return { owner, repo, ref: rest.join("/"), refType: "branch" };
  }
  if (kind === "commit" && rest[0]) {
    return { owner, repo, ref: rest[0], refType: "commit" };
  }
  if (kind === "pull" && rest[0] && /^\d+$/.test(rest[0])) {
    return { owner, repo, refType: "pr", prNumber: Number(rest[0]) };
  }

  return { owner, repo, refType: "default" };
}

/**
 * Resolves a parsed ref to the commit SHAs to snapshot.
 * - commit: the single SHA.
 * - branch/default: up to `maxCommits` commits on the connector's branch
 *   (already configured at construction).
 * - pr: every commit in the pull request, listed by the connector, which was
 *   built for the same `owner/repo`.
 */
export async function resolveGitHubCommitShas(
  parsed: ParsedGitHubRef,
  connector: GitHubCommitSource,
  maxCommits: number = 20
): Promise<string[]> {
  if (parsed.refType === "commit" && parsed.ref) {
    return [parsed.ref];
  }

  if (parsed.refType === "pr" && parsed.prNumber) {
    if (!connector.listPullRequestCommits) {
      throw new Error("The installed GitHub connector cannot list pull request commits");
    }
    return connector.listPullRequestCommits(parsed.prNumber, maxCommits);
  }

  const items = await connector.fetchItems({ maxCommits });
  return items.map((item) => item.id);
}
