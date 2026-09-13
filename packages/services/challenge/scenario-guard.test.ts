import { describe, it, expect, vi } from "vitest";

import { assertScenarioChallenge } from "./scenario-guard.js";
import { ScenarioModeError } from "./scenario-errors.js";
import type { Challenge } from "../../database-service/domain/entities.js";

const VCH = "vch-1";
const SOURCE = "source-ch-1";

function makeChallengeRepo(challenges: Record<string, Challenge | null>) {
  return { findById: vi.fn(async (id: string) => challenges[id] ?? null) };
}

describe("assertScenarioChallenge", () => {
  it("resolves and returns the validation challenge when its source is a code challenge", async () => {
    const validation: Challenge = {
      uuid: VCH, title: "Usability walkthrough", status: "active", type: "validation",
      contribution_points_reward: 12000, completion: 0, project_id: "proj-1",
      source_challenge_id: SOURCE, cp_per_validation: 200,
      required_validations: null, compute_enabled: false,
    } as Challenge;
    const source: Challenge = { uuid: SOURCE, type: "code" } as Challenge;
    const challengeRepo = makeChallengeRepo({ [VCH]: validation, [SOURCE]: source });

    const result = await assertScenarioChallenge(challengeRepo, VCH);

    expect(result).toBe(validation);
  });

  it("throws ScenarioModeError when the source challenge is an ML challenge", async () => {
    const validation: Challenge = {
      uuid: VCH, type: "validation", source_challenge_id: SOURCE,
    } as Challenge;
    const source: Challenge = { uuid: SOURCE, type: "ml" } as Challenge;
    const challengeRepo = makeChallengeRepo({ [VCH]: validation, [SOURCE]: source });

    await expect(assertScenarioChallenge(challengeRepo, VCH)).rejects.toThrow(ScenarioModeError);
  });

  it("throws when the challenge has no source_challenge_id at all", async () => {
    const validation: Challenge = {
      uuid: VCH, type: "validation", source_challenge_id: null,
    } as Challenge;
    const challengeRepo = makeChallengeRepo({ [VCH]: validation });

    await expect(assertScenarioChallenge(challengeRepo, VCH)).rejects.toThrow(ScenarioModeError);
  });

  it("throws when the challenge itself is not a validation challenge", async () => {
    const notValidation: Challenge = {
      uuid: VCH, type: "code", source_challenge_id: null,
    } as Challenge;
    const challengeRepo = makeChallengeRepo({ [VCH]: notValidation });

    await expect(assertScenarioChallenge(challengeRepo, VCH)).rejects.toThrow(ScenarioModeError);
  });

  it("throws rather than treat a deleted source challenge as scenario mode", async () => {
    // La source a été supprimée entre-temps : findById renvoie null. Le
    // mode ne doit surtout pas être déduit d'une absence de garde-fou.
    const validation: Challenge = {
      uuid: VCH, type: "validation", source_challenge_id: SOURCE,
    } as Challenge;
    const challengeRepo = makeChallengeRepo({ [VCH]: validation, [SOURCE]: null });

    await expect(assertScenarioChallenge(challengeRepo, VCH)).rejects.toThrow(ScenarioModeError);
  });
});
