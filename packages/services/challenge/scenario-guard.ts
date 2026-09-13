import type { Challenge } from "../../database-service/domain/entities.js";
import { validationModeFor } from "./validation-mode.js";
import { ScenarioModeError } from "./scenario-errors.js";

/**
 * « Ce challenge est-il bien un challenge de validation en mode scénario ? »
 *
 * Deux lectures, parce que le mode se déduit du type du challenge source et
 * ne se stocke jamais. Extraite dans son propre fichier parce que
 * ScenarioStepsService et ScenarioWalkthroughService posent exactement la
 * même question, et qu'une règle dupliquée est une règle qui divergera.
 *
 * Renvoie le challenge de validation, que les appelants ont de toute façon
 * besoin de lire (pool, cp_per_validation).
 */
export async function assertScenarioChallenge(
  challengeRepo: { findById(id: string): Promise<Challenge | null> },
  validationChallengeId: string
): Promise<Challenge> {
  const challenge = await challengeRepo.findById(validationChallengeId);
  if (!challenge || challenge.type !== "validation") {
    throw new ScenarioModeError("Not a validation challenge");
  }
  const source = challenge.source_challenge_id
    ? await challengeRepo.findById(challenge.source_challenge_id)
    : null;
  if (validationModeFor(source?.type) !== "scenario") {
    throw new ScenarioModeError("This validation challenge does not use a scenario walkthrough");
  }
  return challenge;
}
