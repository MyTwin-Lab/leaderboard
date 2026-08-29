import {
  ChallengeRepository,
  ContributionRepository,
  ValidationTargetRepository,
  UserRepository,
  ReferenceCaseRepository,
  CaseClaimRepository,
} from "../../database-service/repositories/index.js";
import type { ValidationReferenceCase, ValidationCaseClaim } from "../../database-service/domain/entities.js";
import { proxyFileToEndpoint, EndpointCallError, type ProxyResult } from "./endpoint-proxy.js";
import { SelfVoteError, ValidationTargetError } from "./validation-challenge.service.js";

export { EndpointCallError, SelfVoteError, ValidationTargetError };

/** A non-medical_pro user tried to author/claim/observe/reveal. */
export class InsufficientRoleError extends Error {}
/** Authoring a case would exceed `required_validations` cases on this challenge. */
export class ReferenceCaseQuotaError extends Error {}
/** A medical_pro tried to claim or author-conflict with a case they wrote themselves. */
export class SelfAuthoredCaseError extends Error {}
/** Lost the claim race — another validator claimed this case on this target first. */
export class DuplicateClaimError extends Error {}
/** The referenced claim doesn't exist. */
export class ClaimNotFoundError extends Error {}
/** The caller doesn't own this claim. */
export class ForbiddenClaimAccessError extends Error {}
/** recordObservation called on a claim that already has one. */
export class ObservationAlreadyRecordedError extends Error {}
/** revealExpectedOutput called before an observation was recorded — the anti-confirmation-bias gate. */
export class ObservationRequiredError extends Error {}

export interface ReferenceCaseDeps {
  challengeRepo: Pick<ChallengeRepository, "findById">;
  targetRepo: Pick<ValidationTargetRepository, "findByChallengeAndContribution">;
  contributionRepo: Pick<ContributionRepository, "findById">;
  userRepo: Pick<UserRepository, "findById">;
  caseRepo: ReferenceCaseRepository;
  caseClaimRepo: CaseClaimRepository;
}

/**
 * ReferenceCaseService
 * ---------------------
 * Owns the ground-truth reference case lifecycle described in
 * challenges/challenge-014-qualified_validation/SPEC.md section 4.3:
 * a medical_pro writes exactly `required_validations` cases per validation
 * challenge, another medical_pro claims one on a target (which tests it
 * against the live endpoint in one atomic gesture), records an observation,
 * and only then may the case's expected output be revealed to them — the
 * server-side enforcement point for "note first, see the answer after".
 *
 * `ValidationChallengeService.castVerdict` independently re-checks that a
 * claim is revealed before accepting a verdict from it — defense in depth,
 * not reliance on this service alone.
 */
export class ReferenceCaseService {
  private deps: ReferenceCaseDeps;

  constructor(deps?: Partial<ReferenceCaseDeps>) {
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      targetRepo: new ValidationTargetRepository(),
      contributionRepo: new ContributionRepository(),
      userRepo: new UserRepository(),
      caseRepo: new ReferenceCaseRepository(),
      caseClaimRepo: new CaseClaimRepository(),
      ...deps,
    };
  }

  async authorCase(input: {
    validationChallengeId: string;
    authorUserId: string;
    input: { buffer: Buffer; filename: string; contentType: string };
    expectedOutput: { buffer: Buffer; filename: string | null; contentType: string };
  }): Promise<ValidationReferenceCase> {
    const { validationChallengeId, authorUserId } = input;

    const challenge = await this.deps.challengeRepo.findById(validationChallengeId);
    if (!challenge || challenge.type !== "validation") {
      throw new ValidationTargetError("Not a validation challenge");
    }
    const requiredValidations = challenge.required_validations ?? 0;
    if (requiredValidations <= 0) {
      throw new ValidationTargetError("This validation challenge has no required_validations configured");
    }

    const author = await this.deps.userRepo.findById(authorUserId);
    if (!author || author.role !== "medical_pro") {
      throw new InsufficientRoleError("Only medical_pro users can author a reference case");
    }

    const existingCount = await this.deps.caseRepo.countByChallenge(validationChallengeId);
    if (existingCount >= requiredValidations) {
      throw new ReferenceCaseQuotaError(
        `This validation challenge already has its ${requiredValidations} reference case(s)`
      );
    }

    return this.deps.caseRepo.create({
      validation_challenge_id: validationChallengeId,
      author_user_id: authorUserId,
      input_bytes: input.input.buffer,
      input_filename: input.input.filename,
      input_content_type: input.input.contentType,
      expected_output_bytes: input.expectedOutput.buffer,
      expected_output_filename: input.expectedOutput.filename,
      expected_output_content_type: input.expectedOutput.contentType,
    });
  }

  async listClaimableCases(input: {
    validationChallengeId: string;
    contributionId: string;
    requestingUserId: string;
  }): Promise<ValidationReferenceCase[]> {
    const target = await this.deps.targetRepo.findByChallengeAndContribution(
      input.validationChallengeId,
      input.contributionId
    );
    if (!target) {
      throw new ValidationTargetError("Submission is not exposed on this validation challenge");
    }
    return this.deps.caseRepo.findClaimable(input.validationChallengeId, input.contributionId, input.requestingUserId);
  }

  async claimCase(input: {
    validationChallengeId: string;
    contributionId: string;
    referenceCaseId: string;
    validatorUserId: string;
  }): Promise<{ claim: ValidationCaseClaim; liveResponse: ProxyResult }> {
    const { validationChallengeId, contributionId, referenceCaseId, validatorUserId } = input;

    const validator = await this.deps.userRepo.findById(validatorUserId);
    if (!validator || validator.role !== "medical_pro") {
      throw new InsufficientRoleError("Only medical_pro users can claim a reference case");
    }

    const challenge = await this.deps.challengeRepo.findById(validationChallengeId);
    if (!challenge || challenge.type !== "validation") {
      throw new ValidationTargetError("Not a validation challenge");
    }

    const target = await this.deps.targetRepo.findByChallengeAndContribution(validationChallengeId, contributionId);
    if (!target) {
      throw new ValidationTargetError("Submission is not exposed on this validation challenge");
    }

    const contribution = await this.deps.contributionRepo.findById(contributionId);
    if (!contribution?.live_endpoint_url) {
      throw new ValidationTargetError("Submission has no deployed endpoint");
    }
    if (contribution.user_id === validatorUserId) {
      throw new SelfVoteError("Cannot validate your own submission");
    }

    const referenceCase = await this.deps.caseRepo.findInputById(referenceCaseId);
    if (!referenceCase || referenceCase.validation_challenge_id !== validationChallengeId) {
      throw new ValidationTargetError("Reference case not found on this validation challenge");
    }
    if (referenceCase.author_user_id === validatorUserId) {
      throw new SelfAuthoredCaseError("Cannot claim a reference case you authored yourself");
    }

    // Claim and test are one gesture: the endpoint is called before any DB
    // row exists. If the insert below loses the unique-index race, this
    // response is simply discarded — there is no retry, and no "reserved but
    // untested" row is ever created.
    const liveResponse = await proxyFileToEndpoint(contribution.live_endpoint_url, {
      buffer: referenceCase.input_bytes,
      filename: referenceCase.input_filename,
      mimeType: referenceCase.input_content_type,
    });

    const created = await this.deps.caseClaimRepo.create({
      reference_case_id: referenceCaseId,
      contribution_id: contributionId,
      validator_user_id: validatorUserId,
      response_bytes: liveResponse.body,
      response_content_type: liveResponse.contentType,
      response_status: liveResponse.status,
    });
    if (!created) {
      throw new DuplicateClaimError("This reference case was just claimed on this target by someone else");
    }

    return { claim: created, liveResponse };
  }

  async recordObservation(input: {
    claimId: string;
    validatorUserId: string;
    observation: string;
  }): Promise<ValidationCaseClaim> {
    const claim = await this.deps.caseClaimRepo.findById(input.claimId);
    if (!claim) throw new ClaimNotFoundError("Reference case claim not found");
    if (claim.validator_user_id !== input.validatorUserId) {
      throw new ForbiddenClaimAccessError("This claim does not belong to you");
    }

    const updated = await this.deps.caseClaimRepo.markObserved(input.claimId, input.observation);
    if (!updated) {
      throw new ObservationAlreadyRecordedError("An observation was already recorded for this claim");
    }
    return updated;
  }

  async revealExpectedOutput(input: {
    claimId: string;
    validatorUserId: string;
  }): Promise<{ contentType: string; filename: string | null; body: Buffer }> {
    const claim = await this.deps.caseClaimRepo.findById(input.claimId);
    if (!claim) throw new ClaimNotFoundError("Reference case claim not found");
    if (claim.validator_user_id !== input.validatorUserId) {
      throw new ForbiddenClaimAccessError("This claim does not belong to you");
    }
    if (!claim.observed_at) {
      throw new ObservationRequiredError("Record an observation before viewing the expected output");
    }

    // Idempotent: a retried request just re-serves the same expected output
    // rather than erroring — markRevealed returning null here only means
    // revealed_at was already set, not that anything went wrong.
    await this.deps.caseClaimRepo.markRevealed(input.claimId);

    const out = await this.deps.caseRepo.findExpectedOutputById(claim.reference_case_id);
    if (!out) throw new ClaimNotFoundError("Reference case not found");

    return {
      contentType: out.expected_output_content_type,
      filename: out.expected_output_filename,
      body: out.expected_output_bytes,
    };
  }
}
