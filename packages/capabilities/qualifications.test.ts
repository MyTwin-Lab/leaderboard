import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlatformRegistry } from "../registry/platform.js";
import {
  declaredQualifications,
  hasQualification,
  isDeclaredQualification,
  qualificationLabel,
} from "./qualifications.js";

describe("qualifications", () => {
  beforeEach(() => {
    PlatformRegistry.reset();
    PlatformRegistry.install({ flows: [], qualifications: [{ key: "nurse", label: "Nurse" }] });
  });
  afterEach(() => PlatformRegistry.reset());

  it("asks the reader whether the account holds the qualification", async () => {
    const has = vi.fn(async (userId: string, key: string) => userId === "u1" && key === "nurse");

    expect(await hasQualification("u1", "nurse", { has })).toBe(true);
    expect(await hasQualification("u2", "nurse", { has })).toBe(false);
  });

  it("qualifies nobody when no key is required, without asking", async () => {
    const has = vi.fn(async () => true);

    expect(await hasQualification("u1", null, { has })).toBe(false);
    expect(await hasQualification("u1", "", { has })).toBe(false);
    expect(has).not.toHaveBeenCalled();
  });

  it("reads the qualifications the distribution declares", () => {
    expect(declaredQualifications().map((q) => q.key)).toEqual(["nurse"]);
    expect(isDeclaredQualification("nurse")).toBe(true);
    expect(isDeclaredQualification("pilot")).toBe(false);
    expect(qualificationLabel("nurse")).toBe("Nurse");
    expect(qualificationLabel("pilot")).toBe("pilot");
  });
});
