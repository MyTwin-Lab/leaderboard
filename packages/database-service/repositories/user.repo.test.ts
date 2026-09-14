import { describe, it, expect } from "vitest";
import { escapeLikePattern, planAccountDeletion } from "./user.repo.js";
import type { ChallengeTeam, ContributionMember } from "../domain/entities.js";

describe("escapeLikePattern", () => {
  it("escapes %, _ and the backslash itself", () => {
    expect(escapeLikePattern("50%_off\\now")).toBe("50\\%\\_off\\\\now");
  });

  it("leaves an ordinary name untouched", () => {
    expect(escapeLikePattern("Ada Lovelace")).toBe("Ada Lovelace");
  });
});

const U = "user-u";
const A = "user-a";
const B = "user-b";

function row(user_id: string, overrides: Partial<ChallengeTeam> = {}): ChallengeTeam {
  return { challenge_id: "c1", user_id, ...overrides };
}

function share(user_id: string, contribution_id = "k1", share_cp = 10): ContributionMember {
  return { contribution_id, user_id, share_cp };
}

describe("planAccountDeletion", () => {
  it("has nothing to hand over for a solo participant", () => {
    const plan = planAccountDeletion({
      userId: U,
      teams: [row(U, { workspace_ref: "refs/heads/u" })],
      ownedContributions: [{ uuid: "k1", challenge_id: "c1" }],
      members: [],
    });
    expect(plan).toEqual({ handovers: [], conflicts: [] });
  });

  it("hands the group owner's workspace, board and contribution to the next owner", () => {
    const plan = planAccountDeletion({
      userId: U,
      teams: [
        row(U, { group_id: "g", workspace_provider: "github", workspace_ref: "refs/heads/u", workspace_status: "ready" }),
        row(B, { group_id: "g" }),
        row(A, { group_id: "g" }),
        row("user-other-group", { group_id: "h" }),
      ],
      ownedContributions: [{ uuid: "k1", challenge_id: "c1" }],
      members: [share(U), share(A), share(B)],
    });

    expect(plan.conflicts).toEqual([]);
    expect(plan.handovers).toEqual([{
      challengeId: "c1",
      // Même règle que pickGroupOwner : sans workspace, le plus petit user_id.
      toUserId: A,
      workspace: {
        workspace_provider: "github",
        workspace_ref: "refs/heads/u",
        workspace_url: null,
        workspace_status: "ready",
      },
      moveBoard: true,
      contributionIds: ["k1"],
    }]);
  });

  it("does nothing for a plain member: their share cascades, the owner's contribution stays", () => {
    const plan = planAccountDeletion({
      userId: U,
      teams: [row(A, { group_id: "g", workspace_ref: "refs/heads/a" }), row(U, { group_id: "g" })],
      ownedContributions: [],
      members: [],
    });
    expect(plan).toEqual({ handovers: [], conflicts: [] });
  });

  it("returns a shared contribution wrongly owned by a plain member to the group owner", () => {
    const plan = planAccountDeletion({
      userId: U,
      teams: [row(B, { group_id: "g", workspace_ref: "refs/heads/b" }), row(U, { group_id: "g" })],
      ownedContributions: [{ uuid: "k1", challenge_id: "c1" }],
      members: [share(U), share(B)],
    });
    expect(plan.handovers).toEqual([{
      challengeId: "c1",
      toUserId: B,
      workspace: null,
      moveBoard: false,
      contributionIds: ["k1"],
    }]);
  });

  it("flags a conflict when co-members hold shares but nobody is left in the group", () => {
    const plan = planAccountDeletion({
      userId: U,
      teams: [row(U)],
      ownedContributions: [{ uuid: "k1", challenge_id: "c1" }],
      members: [share(U), share(A)],
    });
    expect(plan).toEqual({ handovers: [], conflicts: ["c1"] });
  });
});
