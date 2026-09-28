import type {
  ConsumedClaim,
  ResourceClaim,
  ResourceDrawTransaction,
  ResourceInstance,
  ResourceRepository,
} from "../database-service/repositories/index.js";

export type { ConsumedClaim, ResourceClaim, ResourceInstance } from "../database-service/repositories/index.js";

/**
 * Capacité `resources` — des unités de travail réclamables
 * --------------------------------------------------------
 * Un flow importe des ressources (`resource_instances`) sous un type qu'il
 * nomme, et ses participants les réclament (`resource_claims`) :
 *
 * - une réclamation est **active** (ni consommée, ni libérée, ni échue),
 *   **consommée** (le travail est livré, pour toujours) ou **caduque**
 *   (libérée ou échue) ;
 * - `k` borne les réclamations actives et consommées d'une ressource ; sans
 *   `k`, seule l'unicité par personne s'applique ;
 * - une personne n'a qu'une réclamation vivante par ressource — consommée,
 *   elle ne la retire donc jamais ;
 * - l'échéance est paresseuse : aucun timer, une réclamation échue cesse
 *   simplement de compter.
 *
 * La capacité stocke, réclame et compte. Ce que veut dire un type, une charge,
 * un résultat ou un verdict appartient au flow.
 */

/** Ce que la capacité lit et écrit ; le repository par défaut. */
export type ResourceStore = Pick<
  ResourceRepository,
  | "createMany"
  | "findResource"
  | "findClaim"
  | "findActiveClaim"
  | "consume"
  | "release"
  | "close"
  | "reclose"
  | "stampResolution"
  | "consumedClaims"
  | "listResources"
  | "counts"
> & {
  inDrawTransaction<T>(run: (tx: DrawTransaction) => Promise<T>): Promise<T>;
};

export type DrawTransaction = Pick<
  ResourceDrawTransaction,
  "releaseExpired" | "nextCandidate" | "countTowardK" | "insertClaim"
>;

export interface DrawOptions {
  type: string;
  /** Borne des réclamations actives et consommées ; absente : aucune borne. */
  k?: number;
  /** Durée de vie d'une réclamation ; absente : elle n'échoit pas. */
  ttlHours?: number;
  /** Seulement les ressources de cette classe. */
  class?: string;
}

export interface DrawnResource {
  claimId: string;
  resourceId: string;
  payload: Record<string, unknown>;
  expiresAt: Date | null;
}

/** Une réclamation qui ne peut pas être consommée ; `reason` dit pourquoi. */
export class ClaimNotConsumableError extends Error {
  constructor(readonly reason: "not_found" | "consumed" | "lapsed") {
    super(`Claim cannot be consumed (${reason})`);
  }
}

/**
 * Un tirage essaie au plus ce nombre de candidats. Le préfiltre SQL écarte
 * déjà les ressources pleines ; ne reste que la course perdue sous le verrou.
 */
const MAX_DRAW_ATTEMPTS = 20;

export type ClaimState = "active" | "consumed" | "lapsed";

export function claimState(claim: Pick<ResourceClaim, "consumed_at" | "released_at" | "expires_at">, now = new Date()): ClaimState {
  if (claim.consumed_at) return "consumed";
  if (claim.released_at) return "lapsed";
  if (claim.expires_at && claim.expires_at.getTime() <= now.getTime()) return "lapsed";
  return "active";
}

async function defaultStore(): Promise<ResourceStore> {
  const { ResourceRepository } = await import("../database-service/repositories/index.js");
  return new ResourceRepository();
}

export function resources(store?: ResourceStore) {
  const storeOf = async () => store ?? defaultStore();

  return {
    /** Import d'un lot. Les charges sont déjà validées par le flow. */
    async createMany(
      challengeId: string,
      type: string,
      items: ReadonlyArray<{ payload: Record<string, unknown>; class?: string | null }>,
      opts?: { createdBy?: string | null }
    ): Promise<number> {
      return (await storeOf()).createMany(challengeId, type, items, opts?.createdBy);
    },

    /**
     * Réclame une ressource, en une transaction : libérer les réclamations
     * échues de l'appelant, verrouiller un candidat (`SKIP LOCKED`), recompter
     * sous le verrou, insérer si le compte reste sous `k`. Aucun état
     * intermédiaire n'existe hors de cette transaction.
     */
    async draw(challengeId: string, userId: string, options: DrawOptions): Promise<DrawnResource | null> {
      if (options.k !== undefined && (!Number.isInteger(options.k) || options.k < 1)) {
        throw new Error(`[resources] k must be a positive integer, got ${options.k}`);
      }
      return (await storeOf()).inDrawTransaction(async (tx) => {
        await tx.releaseExpired(challengeId, userId);

        const excluded: string[] = [];
        for (let attempt = 0; attempt < MAX_DRAW_ATTEMPTS; attempt++) {
          const candidate = await tx.nextCandidate({
            challengeId,
            userId,
            type: options.type,
            k: options.k,
            class: options.class,
            excluded,
          });
          if (!candidate) return null;
          excluded.push(candidate.uuid);

          if (options.k !== undefined && (await tx.countTowardK(candidate.uuid)) >= options.k) continue;

          const claim = await tx.insertClaim({
            resourceId: candidate.uuid,
            challengeId,
            userId,
            ttlHours: options.ttlHours,
          });
          if (!claim) continue;
          return { claimId: claim.uuid, resourceId: candidate.uuid, payload: candidate.payload, expiresAt: claim.expires_at };
        }
        return null;
      });
    },

    /** La réclamation active de l'appelant sur ce challenge, s'il en a une. */
    async activeClaim(challengeId: string, userId: string) {
      return (await storeOf()).findActiveClaim(challengeId, userId);
    },

    /** Livre le travail d'une réclamation active. Lève `ClaimNotConsumableError` sinon. */
    async consume(claimId: string, userId: string, result: Record<string, unknown>): Promise<ResourceClaim> {
      const s = await storeOf();
      const consumed = await s.consume(claimId, userId, result);
      if (consumed) return consumed;

      const claim = await s.findClaim(claimId);
      if (!claim || claim.user_id !== userId) throw new ClaimNotConsumableError("not_found");
      throw new ClaimNotConsumableError(claimState(claim) === "consumed" ? "consumed" : "lapsed");
    },

    /** Abandon explicite. `false` si la réclamation n'était pas active ou pas à l'appelant. */
    async release(claimId: string, userId: string): Promise<boolean> {
      return (await storeOf()).release(claimId, userId);
    },

    /** Ferme une ressource ouverte ; `null` si une autre requête l'a fermée d'abord. */
    async close(resourceId: string, verdict: string, resolution?: Record<string, unknown>) {
      return (await storeOf()).close(resourceId, verdict, resolution ?? null);
    },

    /** Change le verdict d'une ressource fermée qui vaut encore `fromVerdict`. */
    async reclose(resourceId: string, fromVerdict: string, verdict: string, resolution: Record<string, unknown>) {
      return (await storeOf()).reclose(resourceId, fromVerdict, verdict, resolution);
    },

    /** Pose une clé de `resolution` une seule fois ; `null` si elle y est déjà. */
    async stampResolution(resourceId: string, key: string, value: unknown) {
      return (await storeOf()).stampResolution(resourceId, key, value);
    },

    async resource(resourceId: string) {
      return (await storeOf()).findResource(resourceId);
    },

    async claim(claimId: string) {
      return (await storeOf()).findClaim(claimId);
    },

    /** Les réclamations consommées d'une ressource, pour résoudre un accord. */
    async consumedClaims(resourceId: string): Promise<ConsumedClaim[]> {
      return (await storeOf()).consumedClaims({ resourceId });
    },

    /** Les réclamations consommées d'un challenge, d'une personne ou d'un type ; les plus récentes d'abord. */
    async consumedBy(filter: { challengeId: string; userId?: string; type?: string }): Promise<ConsumedClaim[]> {
      return (await storeOf()).consumedClaims(filter);
    },

    async list(filter: Parameters<ResourceStore["listResources"]>[0]) {
      return (await storeOf()).listResources(filter);
    },

    /** Avancement d'un challenge : les ressources par type, état et verdict. */
    async counts(challengeId: string) {
      return (await storeOf()).counts(challengeId);
    },
  };
}

export type Resources = ReturnType<typeof resources>;
