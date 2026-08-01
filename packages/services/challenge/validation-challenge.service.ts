import {
  ChallengeRepository,
  ContributionRepository,
  ValidationTargetRepository,
  ValidationAttemptRepository,
  RewardEntryRepository,
} from "../../database-service/repositories/index.js";
import type { RewardEntryDraft } from "../../database-service/repositories/index.js";
import type { Challenge, Contribution, ValidationAttempt } from "../../database-service/domain/entities.js";
import { assertPublicHttpUrl } from "./ssrf-guard.js";

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/** The submission isn't exposed on this validation challenge, or has no endpoint — a 4xx-shaped problem. */
export class ValidationTargetError extends Error {}
/** The proxied call itself failed (SSRF-blocked, unreachable, timed out, too large) — a 5xx-shaped problem. */
export class EndpointCallError extends Error {}
/** A validator tried to cast a verdict on their own submission. */
export class SelfVoteError extends Error {}
/** A validator tried to cast a second verdict on a target they already voted on. */
export class DuplicateVerdictError extends Error {}

export interface ValidationFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/** The raw result of proxying a file to a target's endpoint — no CP, no verdict. */
export interface ValidationCallResult {
  status: number;
  contentType: string;
  body: Buffer;
}

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
      file_bytes: Buffer;
      file_filename: string;
      file_content_type: string;
      response_bytes: Buffer;
      response_content_type: string;
      response_status: number;
    }) => Promise<ValidationAttempt | null>;
    findByChallengeAndContribution: (validationChallengeId: string, contributionId: string) => Promise<ValidationAttempt[]>;
  };
  contributionRepo: Pick<ContributionRepository, "findById" | "findByChallenge" | "create" | "update">;
  rewardRepo: Pick<RewardEntryRepository, "sumByChallenge" | "createManyAndSyncRewards">;
  callEndpoint: (url: string, file: ValidationFile) => Promise<ValidationCallResult>;
}

/**
 * ValidationChallengeService
 * ---------------------------
 * `validate()` proxies a "drop a file, see the API's output" call — pure
 * network I/O, no CP, no identity involved. `castVerdict()` records what a
 * validator concluded after seeing that output and, once a target collects
 * `required_validations` verdicts, resolves it: the majority side is paid
 * `cp_per_validation` each (clamped to the pool, earliest voters first), the
 * minority gets nothing, and the outcome is permanent.
 *
 * The browser never calls the target endpoint directly (CORS + trust — see
 * the design doc); this service is the one thing that observes the response,
 * so it's the one thing allowed to decide whether CP is earned.
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
      callEndpoint: (url, file) => this.callEndpointDefault(url, file),
      ...deps,
    };
  }

  async validate(input: {
    validationChallengeId: string;
    contributionId: string;
    validatorUserId: string;
    file: ValidationFile;
  }): Promise<ValidationCallResult> {
    const { validationChallengeId, contributionId, validatorUserId, file } = input;

    const challenge = await this.deps.challengeRepo.findById(validationChallengeId);
    if (!challenge || challenge.type !== "validation") {
      throw new ValidationTargetError("Not a validation challenge");
    }

    const targets = await this.deps.targetRepo.findByChallenge(validationChallengeId);
    if (!targets.some(t => t.contribution_id === contributionId)) {
      throw new ValidationTargetError("Submission is not exposed on this validation challenge");
    }

    const contribution = await this.deps.contributionRepo.findById(contributionId);
    if (!contribution?.live_endpoint_url) {
      throw new ValidationTargetError("Submission has no deployed endpoint");
    }

    if (contribution.user_id === validatorUserId) {
      throw new SelfVoteError("Cannot validate your own submission");
    }

    try {
      await assertPublicHttpUrl(contribution.live_endpoint_url);
      return await this.deps.callEndpoint(contribution.live_endpoint_url, file);
    } catch (error) {
      throw new EndpointCallError(error instanceof Error ? error.message : String(error));
    }
  }

  async castVerdict(input: {
    validationChallengeId: string;
    contributionId: string;
    validatorUserId: string;
    verdict: "works" | "broken";
    description: string | null;
    /** Exactly what the validator dropped and exactly what they saw — persisted for manager review. */
    file: ValidationFile;
    response: ValidationCallResult;
  }): Promise<CastVerdictResult> {
    const { validationChallengeId, contributionId, validatorUserId, verdict, description, file, response } = input;

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
      file_bytes: file.buffer,
      file_filename: file.filename,
      file_content_type: file.mimeType,
      response_bytes: response.body,
      response_content_type: response.contentType,
      response_status: response.status,
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

  private async callEndpointDefault(url: string, file: ValidationFile): Promise<ValidationCallResult> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // `redirect: "manual"` is load-bearing for the SSRF guard: `assertPublicHttpUrl`
      // only validates the URL we were given, not wherever a 3xx response might
      // point. Following redirects automatically would let a malicious target
      // redirect this server-side call to a private address after the check
      // already passed. Node's fetch returns the raw redirect response (not an
      // opaque one) under "manual", so we can detect and reject it explicitly.
      const res = await fetch(url, { method: "POST", body: form, signal: controller.signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        throw new Error(`Endpoint responded with a redirect (${res.status}) — redirects are not followed`);
      }
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_RESPONSE_BYTES) {
        throw new Error(`Response exceeded ${MAX_RESPONSE_BYTES} bytes`);
      }
      return { status: res.status, contentType, body: Buffer.from(arrayBuffer) };
    } finally {
      clearTimeout(timeout);
    }
  }
}
