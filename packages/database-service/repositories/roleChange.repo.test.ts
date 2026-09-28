import { describe, it, expect } from "vitest";
import { buildRoleChange } from "./roleChange.repo.js";

describe("buildRoleChange", () => {
  it("records a transition with its author and trimmed note", () => {
    expect(buildRoleChange({
      userId: "u1",
      oldRole: "contributor",
      newRole: "viewer",
      changedBy: "admin-1",
      note: "  RPPS vérifié  ",
    })).toEqual({
      user_id: "u1",
      old_role: "contributor",
      new_role: "viewer",
      changed_by: "admin-1",
      note: "RPPS vérifié",
    });
  });

  it("records the initial role of an admin-created account with old_role null", () => {
    expect(buildRoleChange({ userId: "u1", oldRole: null, newRole: "admin", changedBy: "admin-1" }))
      .toEqual({ user_id: "u1", old_role: null, new_role: "admin", changed_by: "admin-1", note: null });
  });

  it("records nothing when the role does not actually change", () => {
    expect(buildRoleChange({ userId: "u1", oldRole: "viewer", newRole: "viewer", changedBy: "admin-1" })).toBeNull();
  });
});
