import { describe, it, expect } from "vitest";
import type { Challenge } from "../../../packages/database-service/domain/entities.js";
import { codeCreationRepos, parseGithubSlug } from "./repos.js";

const TITLE = "Triage assistant";
const SLUG = "acme/triage";

function challenge(flow_config: Record<string, unknown> = {}): Challenge {
  return { uuid: "c-1", title: TITLE, type: "code", flow_config } as Challenge;
}

describe("codeCreationRepos", () => {
  it("creates the one shared repo of a provided_repo challenge, with the slug given at creation", () => {
    expect(codeCreationRepos({ challenge: challenge({ workspace_mode: "provided_repo" }), input: { github_repo: SLUG } })).toEqual({
      repos: [{ title: `${TITLE} — Code`, type: "github", external_repo_id: SLUG }],
    });
  });

  it("falls back to provided_repo when the configuration does not say", () => {
    expect(codeCreationRepos({ challenge: challenge(), input: {} }).repos).toEqual([
      { title: `${TITLE} — Code`, type: "github", external_repo_id: undefined },
    ]);
  });

  it("creates no repo in own_repo mode: each contributor brings theirs", () => {
    expect(codeCreationRepos({ challenge: challenge({ workspace_mode: "own_repo" }), input: { github_repo: SLUG } })).toEqual({ repos: [] });
  });
});

describe("parseGithubSlug", () => {
  it("reads owner/repo from a GitHub URL, without .git", () => {
    expect(parseGithubSlug("https://github.com/acme/triage.git")).toBe(SLUG);
    expect(parseGithubSlug("https://github.com/acme/triage/tree/main")).toBe(SLUG);
  });

  it("keeps a bare slug, and ignores anything else", () => {
    expect(parseGithubSlug(SLUG)).toBe(SLUG);
    expect(parseGithubSlug("not a repo")).toBeUndefined();
    expect(parseGithubSlug(undefined)).toBeUndefined();
  });
});
