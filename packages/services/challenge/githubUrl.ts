import { Octokit } from "octokit";
import type { GitHubExternalConnector } from "../../connectors/implementation/Github.connector.js";

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
 * - pr: every commit in the pull request — no connector method exists for
 *   this, so it's a direct Octokit call reusing the same token.
 */
export async function resolveGitHubCommitShas(
  parsed: ParsedGitHubRef,
  connector: GitHubExternalConnector,
  token: string,
  maxCommits: number = 20
): Promise<string[]> {
  if (parsed.refType === "commit" && parsed.ref) {
    return [parsed.ref];
  }

  if (parsed.refType === "pr" && parsed.prNumber) {
    const octokit = new Octokit({ auth: token });
    const shas: string[] = [];
    let page = 1;
    while (shas.length < maxCommits) {
      const { data } = await octokit.rest.pulls.listCommits({
        owner: parsed.owner,
        repo: parsed.repo,
        pull_number: parsed.prNumber,
        per_page: 100,
        page,
      });
      if (data.length === 0) break;
      shas.push(...data.map((c) => c.sha));
      if (data.length < 100) break;
      page++;
    }
    return shas.slice(0, maxCommits);
  }

  const items = await connector.fetchItems({ maxCommits });
  return items.map((item) => item.id);
}
