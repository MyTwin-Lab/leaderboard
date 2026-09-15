import { describe, it, expect, vi } from "vitest";
import { assertJourneyValidationChallenge } from "./guard.js";
import { ScenarioModeError } from "../../../packages/services/challenge/scenario-errors.js";
import type { Challenge } from "../../../packages/database-service/domain/entities.js";

const ID = "vch-1";

function repoWith(challenge: Partial<Challenge> | null) {
  return { findById: vi.fn(async () => challenge as Challenge | null) };
}

describe("assertJourneyValidationChallenge", () => {
  it("returns a journey validation challenge", async () => {
    const challenge = { uuid: ID, type: "journey-validation", source_challenge_id: "code-1" };

    await expect(assertJourneyValidationChallenge(repoWith(challenge), ID)).resolves.toBe(challenge);
  });

  it("refuses an endpoint validation challenge, which has no scenario", async () => {
    await expect(
      assertJourneyValidationChallenge(repoWith({ uuid: ID, type: "endpoint-validation" }), ID)
    ).rejects.toThrow(ScenarioModeError);
  });

  it("refuses any other flow, and a missing challenge", async () => {
    await expect(assertJourneyValidationChallenge(repoWith({ uuid: ID, type: "code" }), ID)).rejects.toThrow(ScenarioModeError);
    await expect(assertJourneyValidationChallenge(repoWith(null), ID)).rejects.toThrow(ScenarioModeError);
  });
});
