import { db } from "../db/drizzle";
import { challenges, challenge_repos, challenge_slug_redirects, repos, contributions } from "../db/drizzle";
import { eq, and, gte, inArray, lt, isNotNull } from "drizzle-orm";
import { toDomainChallenge, toDomainRepo, toDomainContribution, toDbChallenge } from "../db/mappers";
import type { Challenge, Repo, Contribution } from "../domain/entities";
import { challengeSchema } from "../domain/schemas_zod";
import { SLUG_FALLBACK, SlugTakenError } from "../domain/slug";
import { availableSlug, claimSlug, isSlugTaken, isSlugUniqueViolation, type SlugOwners } from "./slugs";

/** Ce que fournit un appelant à la création : le slug est optionnel, dérivé du titre s'il manque. */
export type ChallengeDraft = Omit<Challenge, "uuid" | "created_at" | "slug"> & { slug?: string };

/** Les contraintes qu'une écriture de slug peut heurter sous concurrence. */
const SLUG_CONSTRAINTS = ["idx_challenges_slug", "challenge_slug_redirects_pkey"] as const;

/**
 * Décide si un update doit toucher `closed_at`.
 *
 * Extrait de `update()` pour être testable sans base. Trois règles :
 * - arrivée à 'completed' → on date, y compris pour une refermeture (le digest
 *   veut la dernière fermeture, pas la première) ;
 * - départ de 'completed' → on efface, sinon un challenge rouvert traînerait
 *   une date de fermeture périmée que le prochain digest lirait comme vraie ;
 * - 'archived' → rien à poser. Archiver retire des listings, ça ne termine pas.
 *
 * Voir docs/input/spec-digest.md §2.
 */
export function closedAtPatch(
  before: string | undefined,
  next: string | undefined,
): { closed_at?: Date | null } {
  if (next === undefined) return {};
  if (next === "completed") return before === "completed" ? {} : { closed_at: new Date() };
  if (before === "completed") return { closed_at: null };
  return {};
}

export class ChallengeRepository {
  private readonly slugOwners: SlugOwners = {
    currentOwner: async (slug) => {
      const [row] = await db.select({ uuid: challenges.uuid }).from(challenges).where(eq(challenges.slug, slug));
      return row?.uuid ?? null;
    },
    redirectOwner: async (slug) => {
      const [row] = await db
        .select({ uuid: challenge_slug_redirects.challenge_id })
        .from(challenge_slug_redirects)
        .where(eq(challenge_slug_redirects.slug, slug));
      return row?.uuid ?? null;
    },
  };

  async findAll(): Promise<Challenge[]> {
    const rows = await db.select().from(challenges);
    return rows.map(toDomainChallenge);
  }

  async findById(uuid: string): Promise<Challenge | null> {
    const [row] = await db.select().from(challenges).where(eq(challenges.uuid, uuid));
    return row ? toDomainChallenge(row) : null;
  }

  async findByIds(uuids: string[]): Promise<Challenge[]> {
    if (uuids.length === 0) return [];
    const rows = await db.select().from(challenges).where(inArray(challenges.uuid, uuids));
    return rows.map(toDomainChallenge);
  }

  async findBySlug(slug: string): Promise<Challenge | null> {
    const [row] = await db.select().from(challenges).where(eq(challenges.slug, slug));
    return row ? toDomainChallenge(row) : null;
  }

  /** Le challenge vers lequel un ancien slug redirige, `null` si ce slug n'a jamais été abandonné. */
  async findSlugRedirect(slug: string): Promise<string | null> {
    return this.slugOwners.redirectOwner(slug);
  }

  /** Voir `isSlugTaken` dans ./slugs : `exceptId` est le challenge en cours d'édition. */
  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    return isSlugTaken(this.slugOwners, slug, exceptId);
  }

  async availableSlug(base: string, exceptId?: string): Promise<string> {
    return availableSlug(this.slugOwners, base, exceptId);
  }


  /**
   * Fenêtre [start, end) — bornes half-open, pour qu'une row tombant
   * exactement sur une borne appartienne à exactement un digest.
   */
  async findCreatedBetween(start: Date, end: Date): Promise<Challenge[]> {
    const rows = await db
      .select()
      .from(challenges)
      .where(and(gte(challenges.created_at, start), lt(challenges.created_at, end)));
    return rows.map(toDomainChallenge);
  }

  /** Challenges passés à 'completed' dans la fenêtre — voir closedAtPatch. */
  async findClosedBetween(start: Date, end: Date): Promise<Challenge[]> {
    const rows = await db
      .select()
      .from(challenges)
      .where(and(
        isNotNull(challenges.closed_at),
        gte(challenges.closed_at, start),
        lt(challenges.closed_at, end),
      ));
    return rows.map(toDomainChallenge);
  }

  async findRepos(challengeId: string): Promise<Repo[]> {
    const results = await db
      .select({
        repo: repos,
      })
      .from(challenge_repos)
      .leftJoin(repos, eq(challenge_repos.repo_id, repos.uuid))
      .where(eq(challenge_repos.challenge_id, challengeId));
    
    return results.filter(r => r.repo !== null).map(r => toDomainRepo(r.repo!));
  }

  async findContributions(challengeId: string): Promise<Contribution[]> {
    const rows = await db
      .select()
      .from(contributions)
      .where(eq(contributions.challenge_id, challengeId));
    return rows.map(toDomainContribution);
  }

  /**
   * `slug` fourni : il doit être libre (`SlugTakenError` sinon). Absent : dérivé
   * du titre. Voir `claimSlug`.
   */
  async create(entity: ChallengeDraft): Promise<Challenge> {
    const slug = await claimSlug(this.slugOwners, {
      requested: entity.slug,
      title: entity.title,
      fallback: SLUG_FALLBACK.challenge,
    });
    const validated = challengeSchema.omit({ uuid: true, created_at: true }).parse({ ...entity, slug });
    const dbData = toDbChallenge(validated);
    try {
      const [inserted] = await db.insert(challenges).values(dbData).returning();
      return toDomainChallenge(inserted);
    } catch (error) {
      if (isSlugUniqueViolation(error, SLUG_CONSTRAINTS)) {
        throw new SlugTakenError(slug, await this.availableSlug(slug));
      }
      throw error;
    }
  }

  async update(uuid: string, entity: Partial<Omit<Challenge, "uuid">>): Promise<Challenge> {
    const validated = challengeSchema.omit({ uuid: true }).partial().parse(entity);
    const dbData: any = {};
    if (validated.index !== undefined) dbData.index = validated.index;
    if (validated.title) dbData.title = validated.title;
    if (validated.status) dbData.status = validated.status;
    if (validated.start_date !== undefined) dbData.start_date = validated.start_date?.toISOString().split("T")[0] ?? null;
    if (validated.end_date !== undefined) dbData.end_date = validated.end_date?.toISOString().split("T")[0] ?? null;
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.roadmap !== undefined) dbData.roadmap = validated.roadmap || null;
    if (validated.contribution_points_reward !== undefined) dbData.contribution_points_reward = validated.contribution_points_reward;
    if (validated.type !== undefined) dbData.type = validated.type;
    if (validated.project_id) dbData.project_id = validated.project_id;
    if (validated.reward_rules !== undefined) dbData.reward_rules = validated.reward_rules ?? null;
    if (validated.compute_enabled !== undefined) dbData.compute_enabled = validated.compute_enabled;
    // Without this, MlRewardsService.award() writing { completion } here was a
    // silent no-op — the field passed Zod validation but never made it into
    // dbData, so challenges.completion stayed 0 no matter how much CP was
    // distributed. Code challenge completion is no longer task-driven (the old
    // TaskRepository.completeTask was removed with task_assignees) — how it's
    // computed post-personal-boards is decided in a later task.
    if (validated.completion !== undefined) dbData.completion = validated.completion;

    // closed_at n'est jamais fourni par un appelant : il se déduit de la
    // transition de statut. Les deux chemins de fermeture (POST /close et le
    // PUT du drawer, où status est un z.string() libre) passent ici, donc
    // c'est le seul point à couvrir. Le SELECT ne coûte que sur les updates
    // qui portent un statut, ce qui est rare.
    if (validated.status !== undefined) {
      const [before] = await db
        .select({ status: challenges.status })
        .from(challenges)
        .where(eq(challenges.uuid, uuid));
      Object.assign(dbData, closedAtPatch(before?.status, validated.status));
    }

    // Le titre ne touche jamais au slug : une URL ne bouge pas en silence.
    // Un slug modifié, lui, laisse l'ancien en redirection.
    let slugChange: { from: string; to: string } | null = null;
    if (validated.slug !== undefined) {
      const [current] = await db
        .select({ slug: challenges.slug })
        .from(challenges)
        .where(eq(challenges.uuid, uuid));
      if (current && current.slug !== validated.slug) {
        if (await this.isSlugTaken(validated.slug, uuid)) {
          throw new SlugTakenError(validated.slug, await this.availableSlug(validated.slug, uuid));
        }
        slugChange = { from: current.slug, to: validated.slug };
        dbData.slug = validated.slug;
      }
    }

    const change = slugChange;
    try {
      const updated = change
        ? await db.transaction(async (tx) => {
            // Reprendre un de ses propres anciens slugs : il cesse d'être une
            // redirection, sinon il serait à la fois courant et redirigé.
            await tx
              .delete(challenge_slug_redirects)
              .where(and(
                eq(challenge_slug_redirects.slug, change.to),
                eq(challenge_slug_redirects.challenge_id, uuid),
              ));
            await tx
              .insert(challenge_slug_redirects)
              .values({ slug: change.from, challenge_id: uuid })
              .onConflictDoUpdate({
                target: challenge_slug_redirects.slug,
                set: { challenge_id: uuid, created_at: new Date() },
              });
            const [row] = await tx.update(challenges).set(dbData).where(eq(challenges.uuid, uuid)).returning();
            return row;
          })
        : (await db.update(challenges).set(dbData).where(eq(challenges.uuid, uuid)).returning())[0];
      return toDomainChallenge(updated);
    } catch (error) {
      if (change && isSlugUniqueViolation(error, SLUG_CONSTRAINTS)) {
        throw new SlugTakenError(change.to, await this.availableSlug(change.to, uuid));
      }
      throw error;
    }
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(challenges).where(eq(challenges.uuid, uuid));
  }
}
