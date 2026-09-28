import { describe, it, expect } from "vitest";
import { githubEventsOf, toPublicGithubActivity, type GitHubActivityPayload } from "./activity.js";

const PAYLOAD: GitHubActivityPayload = {
  events: [
    {
      type: "commit", id: "e1", title: "feat: scoring", author: "alix",
      date: "2026-03-12T10:00:00Z", url: "https://github.com/org/repo/commit/abc",
      metadata: { sha: "abc1234", additions: 10, deletions: 2, branchName: "contrib/3-alix" },
    },
    {
      type: "pull_request", id: "e2", title: "Fix race", author: "marie",
      date: "2026-03-10T10:00:00Z", url: "https://github.com/org/repo/pull/42",
      metadata: { prNumber: 42, state: "merged", branchName: "contrib/5-marie" },
    },
    {
      type: "branch_created", id: "e3", title: "contrib/7-karim", author: "karim",
      date: "2026-03-09T10:00:00Z", url: "https://github.com/org/repo/tree/contrib/7-karim",
      metadata: { branchName: "contrib/7-karim" },
    },
  ],
};

describe("toPublicGithubActivity", () => {
  it("never publishes a contributor branch name", () => {
    const serialised = JSON.stringify(toPublicGithubActivity(PAYLOAD));
    expect(serialised).not.toContain("contrib/3-alix");
    expect(serialised).not.toContain("contrib/5-marie");
    expect(serialised).not.toContain("contrib/7-karim");
    expect(serialised).not.toContain("branchName");
  });

  it("drops branch_created events, which exist only to name a branch", () => {
    expect(toPublicGithubActivity(PAYLOAD).events.map((e) => e.type)).toEqual(["commit", "pull_request"]);
  });

  it("keeps the commit and pull-request detail the activity feed renders", () => {
    const { events } = toPublicGithubActivity(PAYLOAD);
    expect(events[0]).toEqual({
      type: "commit", id: "e1", title: "feat: scoring", author: "alix",
      date: "2026-03-12T10:00:00Z", url: "https://github.com/org/repo/commit/abc",
      metadata: { sha: "abc1234", additions: 10, deletions: 2 },
    });
    expect(events[1].metadata).toEqual({ prNumber: 42, state: "merged" });
  });

  it("survives a payload without events", () => {
    expect(toPublicGithubActivity(null)).toEqual({ events: [] });
  });
});

describe("githubEventsOf", () => {
  it("reads the events of the first GitHub activity, ignoring other connectors and errors", () => {
    const activities = {
      "repo-0": { error: "unavailable" },
      "repo-1": { connectorKey: "kaggle", payload: { kind: "model" } },
      "repo-2": { connectorKey: "github", payload: PAYLOAD },
    };

    expect(githubEventsOf(activities)).toBe(PAYLOAD.events);
    expect(githubEventsOf({})).toEqual([]);
    expect(githubEventsOf(null)).toEqual([]);
  });
});
