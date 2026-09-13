import { describe, it, expect } from "vitest";
import { validationModeFor, TARGET_CONTRIBUTION_TYPE } from "./validation-mode.js";

describe("validationModeFor", () => {
  it("reads an ml source challenge as the reference-case flow", () => {
    expect(validationModeFor("ml")).toBe("reference_case");
  });

  it("reads a code source challenge as the scenario flow", () => {
    expect(validationModeFor("code")).toBe("scenario");
  });

  it("returns null rather than guessing when there is no source challenge", () => {
    // Volontairement null et non 'reference_case' : un défaut ferait tomber
    // silencieusement un challenge mal câblé dans le flux ML, où il
    // proposerait des cas de référence qui n'existent pas.
    expect(validationModeFor(null)).toBeNull();
    expect(validationModeFor(undefined)).toBeNull();
  });

  it("returns null for a source type that is neither ml nor code", () => {
    expect(validationModeFor("validation")).toBeNull();
  });
});

describe("TARGET_CONTRIBUTION_TYPE", () => {
  it("targets api_packaging submissions in reference-case mode and project deliverables in scenario mode", () => {
    expect(TARGET_CONTRIBUTION_TYPE.reference_case).toBe("api_packaging");
    expect(TARGET_CONTRIBUTION_TYPE.scenario).toBe("project");
  });
});
