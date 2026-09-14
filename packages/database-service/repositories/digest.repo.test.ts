import { describe, it, expect } from "vitest";
import { anonymizeDigestPayload, DELETED_USER_NAME } from "./digest.repo.js";
import type { DigestPayload } from "../domain/entities.js";

function payload(): DigestPayload {
  return {
    version: 2,
    new_contributions: [{
      contribution_id: "k1",
      title: "PR",
      type: "code",
      challenge_id: "c1",
      challenge_title: "Challenge",
      contributors: [
        { user_id: "gone", full_name: "Ada Lovelace" },
        { user_id: "stays", full_name: "Alan Turing" },
      ],
      reward_cp: 10,
    }],
    new_challenges: [],
    completed_challenges: [],
    new_contributors: [{ user_id: "gone", full_name: "Ada Lovelace", role: "contributor", joined_at: "2026-01-01T00:00:00.000Z" }],
    new_sandboxes: [{ sandbox_id: "s1", title: "Idea", type: "ml", author: { user_id: "gone", full_name: "Ada Lovelace" }, star_count: 3 }],
    cp_distributed: [{ user_id: "gone", full_name: "Ada Lovelace", challenge_id: "c1", challenge_title: "Challenge", total_cp: 10, by_rule: {} }],
  };
}

describe("anonymizeDigestPayload", () => {
  it("replaces the deleted account's name in every section and nobody else's", () => {
    const next = anonymizeDigestPayload(payload(), "gone");

    expect(next).not.toBeNull();
    expect(JSON.stringify(next)).not.toContain("Ada Lovelace");
    expect(next!.new_contributions[0].contributors).toEqual([
      { user_id: "gone", full_name: DELETED_USER_NAME },
      { user_id: "stays", full_name: "Alan Turing" },
    ]);
    expect(next!.new_contributors[0].full_name).toBe(DELETED_USER_NAME);
    expect(next!.new_sandboxes![0].author.full_name).toBe(DELETED_USER_NAME);
    expect(next!.cp_distributed[0].full_name).toBe(DELETED_USER_NAME);
  });

  it("returns null when the account is not mentioned, so no row is rewritten", () => {
    expect(anonymizeDigestPayload(payload(), "someone-else")).toBeNull();
  });

  it("does not add a sandbox section to a v1 digest", () => {
    const v1 = { ...payload(), version: 1, new_sandboxes: undefined };
    const next = anonymizeDigestPayload(v1, "gone");
    expect(next!.new_sandboxes).toBeUndefined();
  });
});
