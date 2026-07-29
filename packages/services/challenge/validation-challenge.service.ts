import {
  ChallengeRepository,
  ContributionRepository,
  ValidationTargetRepository,
  ValidationAttemptRepository,
  RewardEntryRepository,
} from "../../database-service/repositories/index.js";
import type { Challenge, Contribution } from "../../database-service/domain/entities.js";
import { assertPublicHttpUrl } from "./ssrf-guard.js";

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/** The submission isn't exposed on this validation challenge, or has no endpoint — a 4xx-shaped problem. */
export class ValidationTargetError extends Error {}
/** The proxied call itself failed (SSRF-blocked, unreachable, timed out, too large) — a 5xx-shaped problem. */
export class EndpointCallError extends Error {}

export interface ValidationFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface ValidationResult {
  status: number;
  contentType: string;
  body: Buffer;
  cpAwarded: number;
  alreadyValidated: boolean;
}

export interface EndpointCallResponse {
  status: number;
  contentType: string;
  body: Buffer;
}

export interface ValidationRunDeps {
  challengeRepo: Pick<ChallengeRepository, "findById">;
  targetRepo: Pick<ValidationTargetRepository, "findByChallenge">;
  attemptRepo: {
    exists: (validationChallengeId: string, contributionId: string, validatorUserId: string) => Promise<boolean>;
    create: (entity: { validation_challenge_id: string; contribution_id: string; validator_user_id: string }) => Promise<unknown>;
  };
  contributionRepo: Pick<ContributionRepository, "findById" | "findByChallenge" | "create" | "update">;
  rewardRepo: Pick<RewardEntryRepository, "sumByChallenge" | "createManyAndSyncRewards">;
  callEndpoint: (url: string, file: ValidationFile) => Promise<EndpointCallResponse>;
}

/**
 * ValidationChallengeService
 * ---------------------------
 * Proxies a "drop a file, see the API's output" validation call and — on a
 * first-time successful call from a given validator against a given target —
 * awards `cp_per_validation` from the validation challenge's own pool.
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
  }): Promise<ValidationResult> {
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

    let response: EndpointCallResponse;
    try {
      await assertPublicHttpUrl(contribution.live_endpoint_url);
      response = await this.deps.callEndpoint(contribution.live_endpoint_url, file);
    } catch (error) {
      throw new EndpointCallError(error instanceof Error ? error.message : String(error));
    }

    const alreadyValidatedBefore = await this.deps.attemptRepo.exists(validationChallengeId, contributionId, validatorUserId);
    let cpAwarded = 0;
    // Set only when `attemptRepo.create` loses a unique-violation race (two
    // concurrent requests from the same validator) — the other request's
    // attempt is now the one of record, so this one reports "already
    // validated" too instead of silently claiming a fresh attempt.
    let raceLost = false;

    if (response.status >= 200 && response.status < 300 && !alreadyValidatedBefore) {
      const remaining = await this.remainingPool(challenge);
      const grant = Math.min(challenge.cp_per_validation ?? 0, remaining);
      if (grant > 0) {
        const attempt = await this.deps.attemptRepo.create({
          validation_challenge_id: validationChallengeId,
          contribution_id: contributionId,
          validator_user_id: validatorUserId,
        });
        if (attempt) {
          const validatorContribution = await this.findOrCreateValidatorContribution(challenge, validatorUserId);
          // createManyAndSyncRewards (not a bare insert) — it recomputes
          // contributions.reward from the ledger in the same transaction, so
          // the cache never drifts from what the rows actually sum to.
          await this.deps.rewardRepo.createManyAndSyncRewards([{
            challenge_id: validationChallengeId,
            user_id: validatorUserId,
            contribution_id: validatorContribution.uuid,
            rule_key: "validation",
            points: grant,
            meta: { targetContributionId: contributionId },
          }]);
          cpAwarded = grant;
        } else {
          raceLost = true;
        }
      }
    }

    return {
      status: response.status,
      contentType: response.contentType,
      body: response.body,
      cpAwarded,
      alreadyValidated: alreadyValidatedBefore || raceLost,
    };
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

  private async callEndpointDefault(url: string, file: ValidationFile): Promise<EndpointCallResponse> {
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
      const res = await fetch(url, {
        method: "POST",
        body: form,
        signal: controller.signal,
        redirect: "manual",
      });
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
