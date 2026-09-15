import { ChallengeRepository } from '../../../../packages/database-service/repositories';
import type { Challenge } from '../../../../packages/database-service/domain/entities';
import { hasQualification, qualificationLabel } from '../../../../packages/capabilities/qualifications';
import { reviewerQualificationOf } from '../../../../content/flows/endpoint-validation';
import { journeyAccessOf } from '../../../../content/flows/journey-validation';

/**
 * Distribution MyTwin — qualifications des flows de validation, côté serveur
 * -------------------------------------------------------------------------
 * Les routes du shell demandent ici si l'appelant peut relire (validation
 * d'endpoints) ou commenter en expert (parcours de scénario), selon la
 * qualification que la configuration du challenge exige. Les actions de flow
 * du lot L4 du challenge 020 portent cette autorisation elles-mêmes.
 */

const challengeRepo = new ChallengeRepository();

async function load(challenge: Challenge | string): Promise<Challenge | null> {
  return typeof challenge === 'string' ? challengeRepo.findById(challenge) : challenge;
}

/** L'appelant détient la qualification exigée des relecteurs de ce challenge. */
export async function isQualifiedReviewer(userId: string, challenge: Challenge | string): Promise<boolean> {
  const resolved = await load(challenge);
  return !!resolved && hasQualification(userId, reviewerQualificationOf(resolved));
}

/** La qualification des avis experts d'un parcours, et son libellé, ou `null`. */
export function expertQualificationOf(challenge: Challenge): { key: string; label: string } | null {
  const key = journeyAccessOf(challenge).expert_comment_qualification;
  return key ? { key, label: qualificationLabel(key) } : null;
}

/** Le libellé de la qualification exigée des relecteurs, pour les messages. */
export function reviewerQualificationLabelOf(challenge: Challenge): string | null {
  const key = reviewerQualificationOf(challenge);
  return key ? qualificationLabel(key) : null;
}
