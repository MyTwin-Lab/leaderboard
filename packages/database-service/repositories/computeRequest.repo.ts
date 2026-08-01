import { db } from "../db/drizzle";
import { compute_requests } from "../db/drizzle";
import { eq, and, lte, inArray } from "drizzle-orm";
import { toDomainComputeRequest, toDbComputeRequest } from "../db/mappers";
import type { ComputeRequest, ComputeRequestExpireReason } from "../domain/entities";
import { computeRequestSchema } from "../domain/schemas_zod";

/** Unique-violation code Postgres raises on a duplicate (challenge, user) pair. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

const ACTIVE_STATUSES = ["approved", "provisioning", "ready"] as const;

/**
 * Excludes access_token_enc/iv — defense in depth so the manager-facing
 * routes can never leak the contributor's instance token even by accident,
 * on top of those routes never selecting it either.
 */
const REQUEST_SUMMARY_COLUMNS = {
  uuid: compute_requests.uuid,
  challenge_id: compute_requests.challenge_id,
  user_id: compute_requests.user_id,
  status: compute_requests.status,
  requested_at: compute_requests.requested_at,
  decided_at: compute_requests.decided_at,
  decided_by: compute_requests.decided_by,
  approved_at: compute_requests.approved_at,
  expires_at: compute_requests.expires_at,
  provisioning_started_at: compute_requests.provisioning_started_at,
  ready_at: compute_requests.ready_at,
  expired_at: compute_requests.expired_at,
  expire_reason: compute_requests.expire_reason,
  failed_at: compute_requests.failed_at,
  error_message: compute_requests.error_message,
  provider_ref: compute_requests.provider_ref,
  provider_parent_ref: compute_requests.provider_parent_ref,
  jupyter_base_url: compute_requests.jupyter_base_url,
  updated_at: compute_requests.updated_at,
};

export class ComputeRequestRepository {
  async findByChallengeAndUser(challengeId: string, userId: string): Promise<ComputeRequest | null> {
    const [row] = await db
      .select(REQUEST_SUMMARY_COLUMNS)
      .from(compute_requests)
      .where(and(eq(compute_requests.challenge_id, challengeId), eq(compute_requests.user_id, userId)));
    return row ? toDomainComputeRequest(row) : null;
  }

  /** Every request on a challenge, oldest first — backs the manager-facing panel. */
  async findByChallenge(challengeId: string): Promise<ComputeRequest[]> {
    const rows = await db
      .select(REQUEST_SUMMARY_COLUMNS)
      .from(compute_requests)
      .where(eq(compute_requests.challenge_id, challengeId))
      .orderBy(compute_requests.requested_at);
    return rows.map(toDomainComputeRequest);
  }

  /** Single full row, including the encrypted token — service-internal use only (reveal/deprovision). */
  async findById(uuid: string): Promise<ComputeRequest | null> {
    const [row] = await db.select().from(compute_requests).where(eq(compute_requests.uuid, uuid));
    return row ? toDomainComputeRequest(row) : null;
  }

  /**
   * Returns null instead of throwing on a duplicate — the unique index is the
   * real "one request per challenge" guarantee under concurrent requests.
   */
  async create(entity: Pick<ComputeRequest, "challenge_id" | "user_id">): Promise<ComputeRequest | null> {
    const validated = computeRequestSchema
      .pick({ challenge_id: true, user_id: true })
      .parse(entity);
    try {
      const [row] = await db
        .insert(compute_requests)
        .values(toDbComputeRequest(validated))
        .returning();
      return toDomainComputeRequest(row);
    } catch (error: any) {
      const code = error?.code ?? error?.cause?.code;
      if (code === POSTGRES_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  async updateApproved(uuid: string, decidedBy: string): Promise<void> {
    const approvedAt = new Date();
    await db
      .update(compute_requests)
      .set({
        status: "approved",
        decided_at: approvedAt,
        decided_by: decidedBy,
        approved_at: approvedAt,
        expires_at: new Date(approvedAt.getTime() + 24 * 60 * 60 * 1000),
        updated_at: new Date(),
      })
      .where(eq(compute_requests.uuid, uuid));
  }

  async updateRejected(uuid: string, decidedBy: string): Promise<void> {
    await db
      .update(compute_requests)
      .set({ status: "rejected", decided_at: new Date(), decided_by: decidedBy, updated_at: new Date() })
      .where(eq(compute_requests.uuid, uuid));
  }

  async updateProvisioningStarted(
    uuid: string,
    data: { provider_ref: string; provider_parent_ref: string; access_token_enc: string; access_token_iv: string }
  ): Promise<void> {
    await db
      .update(compute_requests)
      .set({
        status: "provisioning",
        provisioning_started_at: new Date(),
        provider_ref: data.provider_ref,
        provider_parent_ref: data.provider_parent_ref,
        access_token_enc: data.access_token_enc,
        access_token_iv: data.access_token_iv,
        // A retry after a failed attempt should clear any stale error.
        error_message: null,
        failed_at: null,
        updated_at: new Date(),
      })
      .where(eq(compute_requests.uuid, uuid));
  }

  async updateReady(uuid: string, jupyterBaseUrl: string): Promise<void> {
    await db
      .update(compute_requests)
      .set({ status: "ready", ready_at: new Date(), jupyter_base_url: jupyterBaseUrl, updated_at: new Date() })
      .where(eq(compute_requests.uuid, uuid));
  }

  async updateFailed(uuid: string, errorMessage: string): Promise<void> {
    await db
      .update(compute_requests)
      .set({ status: "failed", failed_at: new Date(), error_message: errorMessage, updated_at: new Date() })
      .where(eq(compute_requests.uuid, uuid));
  }

  async updateExpired(uuid: string, reason: ComputeRequestExpireReason): Promise<void> {
    await db
      .update(compute_requests)
      .set({ status: "expired", expired_at: new Date(), expire_reason: reason, updated_at: new Date() })
      .where(eq(compute_requests.uuid, uuid));
  }

  async markTokenRevealed(uuid: string): Promise<void> {
    await db
      .update(compute_requests)
      .set({ access_token_revealed_at: new Date() })
      .where(eq(compute_requests.uuid, uuid));
  }

  /** Requests whose instance creation is underway — polled by the provisioning cron. */
  async findProvisioningInProgress(): Promise<ComputeRequest[]> {
    const rows = await db
      .select(REQUEST_SUMMARY_COLUMNS)
      .from(compute_requests)
      .where(eq(compute_requests.status, "provisioning"));
    return rows.map(toDomainComputeRequest);
  }

  /** Ready requests whose 24h window has elapsed — swept by the expiration cron. */
  async findExpiredPending(now: Date): Promise<ComputeRequest[]> {
    const rows = await db
      .select(REQUEST_SUMMARY_COLUMNS)
      .from(compute_requests)
      .where(and(eq(compute_requests.status, "ready"), lte(compute_requests.expires_at, now)));
    return rows.map(toDomainComputeRequest);
  }

  /** approved/provisioning/ready requests on a challenge — cut immediately on close/delete. */
  async findActiveForChallenge(challengeId: string): Promise<ComputeRequest[]> {
    const rows = await db
      .select(REQUEST_SUMMARY_COLUMNS)
      .from(compute_requests)
      .where(and(eq(compute_requests.challenge_id, challengeId), inArray(compute_requests.status, ACTIVE_STATUSES as unknown as string[])));
    return rows.map(toDomainComputeRequest);
  }

  /** Across every challenge — gates purging the Scaleway secret after a soft-disconnect. */
  async countActiveGlobally(): Promise<number> {
    const rows = await db
      .select({ uuid: compute_requests.uuid })
      .from(compute_requests)
      .where(inArray(compute_requests.status, ACTIVE_STATUSES as unknown as string[]));
    return rows.length;
  }
}
