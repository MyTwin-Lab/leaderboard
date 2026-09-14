import { describe, it, expect } from "vitest";
import {
  planChallengeTeamMerge,
  planMemberShareMerge,
  planKeyedDedupe,
} from "./accountMerge.repo.js";

type TeamRow = Parameters<typeof planChallengeTeamMerge>[0][number];

function team(overrides: Partial<TeamRow> & Pick<TeamRow, "user_id" | "challenge_id">): TeamRow {
  return {
    workspace_provider: null,
    workspace_ref: null,
    workspace_url: null,
    workspace_status: null,
    group_id: null,
    ...overrides,
  };
}

describe("planChallengeTeamMerge", () => {
  it("leaves rows on distinct challenges to the plain UPDATE", () => {
    const plan = planChallengeTeamMerge(
      [team({ user_id: "p", challenge_id: "c1" })],
      [team({ user_id: "g", challenge_id: "c2" })]
    );
    expect(plan).toEqual({ dropGoogleChallengeIds: [], patches: [] });
  });

  it("drops the absorbed row on a shared challenge — otherwise idx_challenge_teams_unique fails", () => {
    const plan = planChallengeTeamMerge(
      [team({ user_id: "p", challenge_id: "c1", workspace_ref: "refs/heads/p" })],
      [team({ user_id: "g", challenge_id: "c1" })]
    );
    expect(plan.dropGoogleChallengeIds).toEqual(["c1"]);
    expect(plan.patches).toEqual([]);
  });

  it("carries the absorbed row's workspace over when only it has one", () => {
    const plan = planChallengeTeamMerge(
      [team({ user_id: "p", challenge_id: "c1" })],
      [team({
        user_id: "g",
        challenge_id: "c1",
        workspace_provider: "github",
        workspace_ref: "refs/heads/g",
        workspace_url: "https://github.com/o/r/tree/g",
        workspace_status: "ready",
        group_id: "grp-1",
      })]
    );
    expect(plan.patches).toEqual([{
      challenge_id: "c1",
      set: {
        workspace_provider: "github",
        workspace_ref: "refs/heads/g",
        workspace_url: "https://github.com/o/r/tree/g",
        workspace_status: "ready",
        group_id: "grp-1",
      },
    }]);
  });

  it("keeps the placeholder workspace but inherits a group_id it lacked", () => {
    const plan = planChallengeTeamMerge(
      [team({ user_id: "p", challenge_id: "c1", workspace_ref: "refs/heads/p" })],
      [team({ user_id: "g", challenge_id: "c1", group_id: "grp-1" })]
    );
    expect(plan.patches).toEqual([{
      challenge_id: "c1",
      set: expect.objectContaining({ workspace_ref: "refs/heads/p", group_id: "grp-1" }),
    }]);
  });
});

describe("planMemberShareMerge", () => {
  it("sums both shares on a common contribution so Σ share_cp is unchanged", () => {
    const plan = planMemberShareMerge(
      [{ contribution_id: "k1", share_cp: 30 }, { contribution_id: "k2", share_cp: 5 }],
      [{ contribution_id: "k1", share_cp: 12 }, { contribution_id: "k3", share_cp: 7 }]
    );
    expect(plan.sums).toEqual([{ contribution_id: "k1", share_cp: 42 }]);
    expect(plan.dropGoogleContributionIds).toEqual(["k1"]);
  });
});

describe("planKeyedDedupe", () => {
  const key = (r: { key: string | null }) => r.key;

  it("drops the absorbed row on a key collision by default", () => {
    const p = [{ uuid: "p1", key: "a" }];
    const g = [{ uuid: "g1", key: "a" }, { uuid: "g2", key: "b" }];
    expect(planKeyedDedupe(p, g, key)).toEqual({ dropPlaceholder: [], dropGoogle: [g[0]] });
  });

  it("drops the placeholder row instead when preferGoogle says so", () => {
    const p = [{ uuid: "p1", key: "a", done: false }];
    const g = [{ uuid: "g1", key: "a", done: true }];
    const result = planKeyedDedupe(p, g, key, (gr, pr) => gr.done && !pr.done);
    expect(result).toEqual({ dropPlaceholder: [p[0]], dropGoogle: [] });
  });

  it("never treats a null key as a collision (partial unique indexes)", () => {
    const p = [{ uuid: "p1", key: null }];
    const g = [{ uuid: "g1", key: null }];
    expect(planKeyedDedupe(p, g, key)).toEqual({ dropPlaceholder: [], dropGoogle: [] });
  });
});
