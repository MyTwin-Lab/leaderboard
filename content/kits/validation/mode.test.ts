import { describe, it, expect } from "vitest";
import { validationModeOf } from "./mode.js";

describe("validationModeOf", () => {
  it("reads the mode in the deliverable capability the installed flow requires", () => {
    expect(validationModeOf("endpoint-validation")).toBe("reference_case");
    expect(validationModeOf("journey-validation")).toBe("scenario");
  });

  it("gives no mode to a flow that validates nothing", () => {
    expect(validationModeOf("ml")).toBeNull();
    expect(validationModeOf("not-installed")).toBeNull();
    expect(validationModeOf(null)).toBeNull();
  });
});
