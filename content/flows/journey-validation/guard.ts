import type { Challenge } from "../../../packages/database-service/domain/entities.js";
import { ScenarioModeError } from "../../../packages/services/challenge/scenario-errors.js";
import { JOURNEY_VALIDATION_FLOW_KEY } from "./descriptor.js";

/**
 * « Ce challenge est-il bien un parcours de scénario ? » — la question que
 * posent ScenarioStepsService et ScenarioWalkthroughService avant toute
 * lecture ou écriture. Le flow du challenge suffit à y répondre : plus besoin
 * de lire le challenge source pour en déduire un mode.
 *
 * Renvoie le challenge, que les appelants lisent de toute façon (pool, forfait).
 */
export async function assertJourneyValidationChallenge(
  challengeRepo: { findById(id: string): Promise<Challenge | null> },
  challengeId: string,
): Promise<Challenge> {
  const challenge = await challengeRepo.findById(challengeId);
  if (!challenge || challenge.type !== JOURNEY_VALIDATION_FLOW_KEY) {
    throw new ScenarioModeError("This challenge does not use a scenario walkthrough");
  }
  return challenge;
}
