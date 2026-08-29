import {
  ChallengeRepository,
  ContributionRepository,
  ValidationTargetRepository,
  ValidationAttemptRepository,
  RewardEntryRepository,
  UserRepository,
  CaseClaimRepository,
} from "../../database-service/repositories/index.js";
import type { RewardEntryDraft } from "../../database-service/repositories/index.js";
import type { Challenge, Contribution, ValidationAttempt } from "../../database-service/domain/entities.js";

/** The submission isn't exposed on this validation challenge, or has no endpoint — a 4xx-shaped problem. */
export class ValidationTargetError extends Error {}
/** A validator tried to cast a verdict on their own submission. */
export class SelfVoteError extends Error {}
/** A validator tried to cast a second verdict on a target they already voted on. */
export class DuplicateVerdictError extends Error {}
/** A non-medical_pro user tried to cast a verdict on a validation challenge. */
export class InsufficientRoleError extends Error {}
/** The referenced claim doesn't exist. */
export class ClaimNotFoundError extends Error {}
/** The caller doesn't own the claim they're trying to vote from. */
export class ForbiddenClaimAccessError extends Error {}
/** castVerdict was called with a claim whose expected output hasn't been revealed yet. */
export class ClaimNotRevealedError extends Error {}

export interface CastVerdictResult {
  verdictRecorded: boolean;
  resolved: boolean;
  outcome: "pending" | "works" | "broken";
  verdictCount: number;
  requiredValidations: number;
  /** CP granted to *this* validator — 0 unless their vote both matched the
   * resolved majority and there was still pool left when it was their turn. */
  cpAwarded: number;
}

export interface ValidationRunDeps {
  challengeRepo: Pick<ChallengeRepository, "findById">;
  targetRepo: Pick<ValidationTargetRepository, "findByChallenge" | "resolve">;
  attemptRepo: {
    exists: (validationChallengeId: string, contributionId: string, validatorUserId: string) => Promise<boolean>;
    create: (entity: {
      validation_challenge_id: string;
      contribution_id: string;
      validator_user_id: string;
      verdict: "works" | "broken";
      description: string | null;
      file_bytes: Buffer | null;
      file_filename: string | null;
      file_content_type: string | null;
      response_bytes: Buffer | null;
      response_content_type: string | null;
      response_status: number | null;
      reference_case_claim_id: string | null;
    }) => Promise<ValidationAttempt | null>;
    findByChallengeAndContribution: (validationChallengeId: string, contributionId: string) => Promise<ValidationAttempt[]>;
  };
  contributionRepo: Pick<ContributionRepository, "findById" | "findByChallenge" | "create" | "update">;
  rewardRepo: Pick<RewardEntryRepository, "sumByChallenge" | "createManyAndSyncRewards">;
  userRepo: Pick<UserRepository, "findById">;
  caseClaimRepo: Pick<CaseClaimRepository, "findById">;
}

/**
 * ValidationChallengeService
 * ---------------------------
 * `castVerdict()` records what a `medical_pro` validator concluded after
 * testing a reference case's known input against a target's live endpoint
 * (via `ReferenceCaseService.claimCase`/`recordObservation`/
 * `revealExpectedOutput` — see reference-case.service.ts) and, once a target
 * collects `required_validations` verdicts, resolves it: the majority side is
 * paid `cp_per_validation` each (clamped to the pool, earliest voters first),
 * the minority gets nothing, and the outcome is permanent.
 *
 * As of challenge-014, testing only ever happens through a claim — there is
 * no more free-file `validate()` path. A verdict must reference a claim that
 * (a) belongs to the calling validator, (b) targets this same submission, and
 * (c) has already been revealed (observation recorded, expected output
 * shown) — enforced here as defense-in-depth on top of the same checks in
 * ReferenceCaseService.
 */
export class ValidationChallengeService {
  private deps: ValidationRunDeps;

  constructor(deps?: Partial<ValidationRunDeps>) {
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      targetRepo: new ValidationTargetRepository(),
      attemptRepo: new ValidationAttemptRepository(),
      contributionRepo: new ContributionRepository(),
      rewardRepo: new RewardEntryRepository(),
      userRepo: new UserRepository(),
      caseClaimRepo: new CaseClaimRepository(),
      ...deps,
    };
  }

  async castVerdict(input: {
    validationChallengeId: string;
    contributionId: string;
    validatorUserId: string;
    verdict: "works" | "broken";
    /** Required unconditionally as of challenge-014 — no more works/broken distinction. */
    description: string;
    referenceCaseClaimId: string;
  }): Promise<CastVerdictResult> {
    const { validationChallengeId, contributionId, validatorUserId, verdict, description, referenceCaseClaimId } = input;

    const challenge = await this.deps.challengeRepo.findById(validationChallengeId);
    if (!challenge || challenge.type !== "validation") {
      throw new ValidationTargetError("Not a validation challenge");
    }
    const requiredValidations = challenge.required_validations ?? 0;

    const targets = await this.deps.targetRepo.findByChallenge(validationChallengeId);
    const target = targets.find(t => t.contribution_id === contributionId);
    if (!target) {
      throw new ValidationTargetError("Submission is not exposed on this validation challenge");
    }

    const user = await this.deps.userRepo.findById(validatorUserId);
    if (!user || user.role !== "medical_pro") {
      throw new InsufficientRoleError("Only medical_pro users can cast a verdict on a validation challenge");
    }

    const claim = await this.deps.caseClaimRepo.findById(referenceCaseClaimId);
    if (!claim) {
      throw new ClaimNotFoundError("Reference case claim not found");
    }
    if (claim.validator_user_id !== validatorUserId) {
      throw new ForbiddenClaimAccessError("This claim does not belong to you");
    }
    if (claim.contribution_id !== contributionId) {
      throw new ValidationTargetError("This claim was not made against this target");
    }
    if (!claim.revealed_at) {
      throw new ClaimNotRevealedError("View the expected output before casting a verdict");
    }

    const contribution = await this.deps.contributionRepo.findById(contributionId);
    if (!contribution) {
      throw new ValidationTargetError("Submission has no deployed endpoint");
    }
    if (contribution.user_id === validatorUserId) {
      throw new SelfVoteError("Cannot cast a verdict on your own submission");
    }

    const alreadyVoted = await this.deps.attemptRepo.exists(validationChallengeId, contributionId, validatorUserId);
    if (alreadyVoted) {
      throw new DuplicateVerdictError("You already cast a verdict on this submission");
    }

    const created = await this.deps.attemptRepo.create({
      validation_challenge_id: validationChallengeId,
      contribution_id: contributionId,
      validator_user_id: validatorUserId,
      verdict,
      description,
      file_bytes: null,
      file_filename: null,
      file_content_type: null,
      response_bytes: null,
      response_content_type: null,
      response_status: null,
      reference_case_claim_id: claim.uuid,
    });
    if (!created) {
      // Lost a race against another request from the same validator.
      throw new DuplicateVerdictError("You already cast a verdict on this submission");
    }

    const allVerdicts = await this.deps.attemptRepo.findByChallengeAndContribution(validationChallengeId, contributionId);
    const verdictCount = allVerdicts.length;

    if (target.outcome !== "pending" || verdictCount < requiredValidations) {
      return {
        verdictRecorded: true,
        resolved: target.outcome !== "pending",
        outcome: target.outcome,
        verdictCount,
        requiredValidations,
        cpAwarded: 0,
      };
    }

    const worksCount = allVerdicts.filter(v => v.verdict === "works").length;
    const majority: "works" | "broken" = worksCount * 2 > verdictCount ? "works" : "broken";

    const resolvedTarget = await this.deps.targetRepo.resolve(target.uuid, majority);
    if (!resolvedTarget) {
      // Another concurrent request resolved this target first — this vote is
      // already recorded above, it just isn't the one paying out.
      return {
        verdictRecorded: true,
        resolved: true,
        outcome: majority,
        verdictCount,
        requiredValidations,
        cpAwarded: 0,
      };
    }

    const myCp = await this.payMajority(challenge, contributionId, allVerdicts, majority, validatorUserId);

    return {
      verdictRecorded: true,
      resolved: true,
      outcome: majority,
      verdictCount,
      requiredValidations,
      cpAwarded: myCp,
    };
  }

  private async payMajority(
    challenge: Challenge,
    contributionId: string,
    allVerdicts: ValidationAttempt[],
    majority: "works" | "broken",
    callingValidatorId: string
  ): Promise<number> {
    let remaining = await this.remainingPool(challenge);
    const entries: RewardEntryDraft[] = [];
    let myCp = 0;

    for (const v of allVerdicts) {
      if (v.verdict !== majority || remaining <= 0) continue;
      const grant = Math.min(challenge.cp_per_validation ?? 0, remaining);
      if (grant <= 0) continue;
      remaining -= grant;

      const validatorContribution = await this.findOrCreateValidatorContribution(challenge, v.validator_user_id);
      entries.push({
        challenge_id: challenge.uuid,
        user_id: v.validator_user_id,
        contribution_id: validatorContribution.uuid,
        rule_key: "validation",
        points: grant,
        meta: { targetContributionId: contributionId },
      });
      if (v.validator_user_id === callingValidatorId) myCp = grant;
    }

    if (entries.length > 0) {
      await this.deps.rewardRepo.createManyAndSyncRewards(entries);
    }
    return myCp;
  }

  private async remainingPool(challenge: Challenge): Promise<number> {
    const distributed = await this.deps.rewardRepo.sumByChallenge(challenge.uuid);
    return Math.max(0, challenge.contribution_points_reward - distributed);
  }

  private async findOrCreateValidatorContribution(challenge: Challenge, userId: string): Promise<Contribution> {
    const all = await this.deps.contributionRepo.findByChallenge(challenge.uuid);
    const existing = all.find(c => c.type === "validation" && c.user_id === userId);
    if (existing) return existing;
    return this.deps.contributionRepo.create({
      title: "Validations performed",
      type: "validation",
      description: `Validations on ${challenge.title}`,
      reward: 0,
      user_id: userId,
      challenge_id: challenge.uuid,
      submitted_at: new Date(),
      evaluation_status: "done",
    });
  }
}
