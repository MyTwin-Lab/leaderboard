import { describe, it, expect } from "vitest";
import { buildQualificationChange } from "./userQualification.repo.js";

const BASE = { userId: "u1", key: "nurse", changedBy: "admin-1" };

describe("buildQualificationChange", () => {
  it("traces a grant of a qualification not yet held, with its trimmed note", () => {
    expect(buildQualificationChange({ ...BASE, action: "granted", alreadyHeld: false, note: "  RPPS vérifié  " })).toEqual({
      user_id: "u1",
      key: "nurse",
      action: "granted",
      changed_by: "admin-1",
      note: "RPPS vérifié",
    });
  });

  it("traces a revocation of a held qualification", () => {
    expect(buildQualificationChange({ ...BASE, action: "revoked", alreadyHeld: true })).toMatchObject({
      action: "revoked",
      note: null,
    });
  });

  it("traces nothing when nothing changes", () => {
    expect(buildQualificationChange({ ...BASE, action: "granted", alreadyHeld: true })).toBeNull();
    expect(buildQualificationChange({ ...BASE, action: "revoked", alreadyHeld: false })).toBeNull();
  });
});
