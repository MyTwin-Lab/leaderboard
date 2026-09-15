import { db, sandbox_slug_redirects, sandboxes } from "../db/drizzle";
import { and, desc, eq, gte, isNull, lt, ne } from "drizzle-orm";
import { toDomainSandbox } from "../db/mappers";
import type { Sandbox, SandboxEvaluationStatus, SandboxType } from "../domain/entities";
import { SLUG_FALLBACK, SlugTakenError } from "../domain/slug";
import { availableSlug, claimSlug, isSlugTaken, isSlugUniqueViolation, type SlugOwners } from "./slugs";

/** Les contraintes qu'une écriture de slug peut heurter sous concurrence. */
const SLUG_CONSTRAINTS = ["idx_sandboxes_slug", "sandbox_slug_redirects_pkey"] as const;

/** Ce que l'auteur fournit à la création. `type` n'apparaît nulle part ailleurs : il est figé ici. */
export interface SandboxDraft {
  user_id: string;
  type: SandboxType;
  title: string;
  /** Dérivé du titre s'il manque — voir `claimSlug`. */
  slug?: string;
  context?: string | null;
  goals?: string[];
  why?: string | null;
  repo_url: string;
  model_url?: string | null;
  dataset_urls?: string[];
}

/** Édition par l'auteur. Ni `type`, ni `status`, ni les champs d'évaluation : chacun a son chemin dédié. */
export interface SandboxPatch {
  title?: string;
  /** Modifié, l'ancien slug reste une redirection. Le titre, lui, n'y touche jamais. */
  slug?: string;
  context?: string | null;
  goals?: string[];
  why?: string | null;
  repo_url?: string;
  model_url?: string | null;
  dataset_urls?: string[];
}

/**
 * SandboxRepository
 * -----------------
 * Propositions ouvertes déposées par les contributeurs. Voir docs/sandbox.md.
 *
 * La table n'a aucune méthode de suppression : archiver est la seule sortie,
 * parce qu'un sandbox peut avoir payé des paliers et que le ledger
 * (`sandbox_rewards`) est en ON DELETE CASCADE — le supprimer reprendrait des
 * CP déjà attribués, ce que l'économie des stars interdit. La suppression
 * ligne à ligne d'un reward reste un geste d'admin explicite et séparé.
 */
export class SandboxRepository {
  private readonly slugOwners: SlugOwners = {
    currentOwner: async (slug) => {
      const [row] = await db.select({ uuid: sandboxes.uuid }).from(sandboxes).where(eq(sandboxes.slug, slug));
      return row?.uuid ?? null;
    },
    redirectOwner: async (slug) => {
      const [row] = await db
        .select({ uuid: sandbox_slug_redirects.sandbox_id })
        .from(sandbox_slug_redirects)
        .where(eq(sandbox_slug_redirects.slug, slug));
      return row?.uuid ?? null;
    },
  };

  /**
   * Les archivés sont exclus par défaut : le listing public ne les montre pas.
   * L'appelant qui a le droit de les voir (auteur, admin) demande explicitement
   * `includeArchived` puis filtre lui-même sur la propriété.
   */
  async findAll(opts?: { includeArchived?: boolean }): Promise<Sandbox[]> {
    const rows = await db
      .select()
      .from(sandboxes)
      .where(opts?.includeArchived ? undefined : ne(sandboxes.status, "archived"))
      .orderBy(desc(sandboxes.created_at));
    return rows.map(toDomainSandbox);
  }

  async findById(uuid: string): Promise<Sandbox | null> {
    const [row] = await db.select().from(sandboxes).where(eq(sandboxes.uuid, uuid));
    return row ? toDomainSandbox(row) : null;
  }

  /** Archivés compris : c'est la route qui décide de ce qu'un visiteur peut voir. */
  async findBySlug(slug: string): Promise<Sandbox | null> {
    const [row] = await db.select().from(sandboxes).where(eq(sandboxes.slug, slug));
    return row ? toDomainSandbox(row) : null;
  }

  /** Le sandbox vers lequel un ancien slug redirige, `null` si ce slug n'a jamais été abandonné. */
  async findSlugRedirect(slug: string): Promise<string | null> {
    return this.slugOwners.redirectOwner(slug);
  }

  /** Voir `isSlugTaken` dans ./slugs : `exceptId` est le sandbox en cours d'édition. */
  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    return isSlugTaken(this.slugOwners, slug, exceptId);
  }

  async availableSlug(base: string, exceptId?: string): Promise<string> {
    return availableSlug(this.slugOwners, base, exceptId);
  }

  /**
   * Sandboxes créés dans la fenêtre — c'est ce que lit le digest.
   *
   * Les archivés sont inclus : le digest raconte ce qui s'est passé sur la
   * période, et un sandbox déposé puis archivé a bien été déposé. Le rendu
   * d'un digest est figé, il ne doit pas dépendre d'un statut qui bouge après.
   */
  async findCreatedBetween(start: Date, end: Date): Promise<Sandbox[]> {
    const rows = await db
      .select()
      .from(sandboxes)
      .where(and(gte(sandboxes.created_at, start), lt(sandboxes.created_at, end)))
      .orderBy(desc(sandboxes.created_at));
    return rows.map(toDomainSandbox);
  }

  /** Y compris les archivés : l'auteur voit toujours les siens. */
  async findByUser(userId: string): Promise<Sandbox[]> {
    const rows = await db
      .select()
      .from(sandboxes)
      .where(eq(sandboxes.user_id, userId))
      .orderBy(desc(sandboxes.created_at));
    return rows.map(toDomainSandbox);
  }

  /**
   * Uniquement les identifiants : c'est tout ce dont le rattachement des stars
   * anonymes a besoin pour écarter les auto-stars, et charger les rows
   * complètes pour ça serait du gaspillage à chaque connexion.
   */
  async findIdsOwnedBy(userId: string): Promise<string[]> {
    const rows = await db
      .select({ uuid: sandboxes.uuid })
      .from(sandboxes)
      .where(eq(sandboxes.user_id, userId));
    return rows.map((row) => row.uuid);
  }

  async create(draft: SandboxDraft): Promise<Sandbox> {
    const slug = await claimSlug(this.slugOwners, {
      requested: draft.slug,
      title: draft.title,
      fallback: SLUG_FALLBACK.sandbox,
    });
    try {
      const [inserted] = await db
        .insert(sandboxes)
        .values({
          user_id: draft.user_id,
          type: draft.type,
          title: draft.title,
          slug,
          context: draft.context ?? null,
          goals: draft.goals ?? [],
          why: draft.why ?? null,
          repo_url: draft.repo_url,
          model_url: draft.model_url ?? null,
          dataset_urls: draft.dataset_urls ?? [],
        })
        .returning();
      return toDomainSandbox(inserted);
    } catch (error) {
      if (isSlugUniqueViolation(error, SLUG_CONSTRAINTS)) {
        throw new SlugTakenError(slug, await this.availableSlug(slug));
      }
      throw error;
    }
  }

  /**
   * Patch partiel : une clé absente n'est pas écrite, pour qu'un formulaire
   * partiel n'efface pas ce qu'il n'affichait pas. `null` est une valeur, pas
   * une absence — c'est ainsi qu'on vide `model_url`.
   */
  async update(uuid: string, patch: SandboxPatch): Promise<Sandbox | null> {
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.context !== undefined) set.context = patch.context;
    if (patch.goals !== undefined) set.goals = patch.goals;
    if (patch.why !== undefined) set.why = patch.why;
    if (patch.repo_url !== undefined) set.repo_url = patch.repo_url;
    if (patch.model_url !== undefined) set.model_url = patch.model_url;
    if (patch.dataset_urls !== undefined) set.dataset_urls = patch.dataset_urls;

    let change: { from: string; to: string } | null = null;
    if (patch.slug !== undefined) {
      const [current] = await db.select({ slug: sandboxes.slug }).from(sandboxes).where(eq(sandboxes.uuid, uuid));
      if (!current) return null;
      if (current.slug !== patch.slug) {
        if (await this.isSlugTaken(patch.slug, uuid)) {
          throw new SlugTakenError(patch.slug, await this.availableSlug(patch.slug, uuid));
        }
        change = { from: current.slug, to: patch.slug };
        set.slug = patch.slug;
      }
    }

    const slugChange = change;
    try {
      const [updated] = slugChange
        ? await db.transaction(async (tx) => {
            // Reprendre un de ses propres anciens slugs : il cesse d'être une redirection.
            await tx
              .delete(sandbox_slug_redirects)
              .where(and(eq(sandbox_slug_redirects.slug, slugChange.to), eq(sandbox_slug_redirects.sandbox_id, uuid)));
            await tx
              .insert(sandbox_slug_redirects)
              .values({ slug: slugChange.from, sandbox_id: uuid })
              .onConflictDoUpdate({
                target: sandbox_slug_redirects.slug,
                set: { sandbox_id: uuid, created_at: new Date() },
              });
            return tx.update(sandboxes).set(set).where(eq(sandboxes.uuid, uuid)).returning();
          })
        : await db.update(sandboxes).set(set).where(eq(sandboxes.uuid, uuid)).returning();
      return updated ? toDomainSandbox(updated) : null;
    } catch (error) {
      if (slugChange && isSlugUniqueViolation(error, SLUG_CONSTRAINTS)) {
        throw new SlugTakenError(slugChange.to, await this.availableSlug(slugChange.to, uuid));
      }
      throw error;
    }
  }

  /**
   * Transition de statut d'évaluation, avec garde optionnelle sur le statut
   * courant.
   *
   * `expectedFrom` ferme la course des deux `POST /evaluation` simultanés :
   * passer à `running` en exigeant `pending` ne réussit qu'une fois, et le
   * retour `false` dit à l'appelant qu'un autre run a pris la main. Sans
   * garde, l'appel écrase inconditionnellement.
   */
  async setEvaluationStatus(
    uuid: string,
    status: SandboxEvaluationStatus,
    opts?: { expectedFrom?: SandboxEvaluationStatus | null }
  ): Promise<boolean> {
    const filters = [eq(sandboxes.uuid, uuid)];
    const expectedFrom = opts?.expectedFrom;
    if (expectedFrom !== undefined) {
      // `null` attendu = jamais évalué, ce qui est un IS NULL et non une égalité.
      filters.push(
        expectedFrom === null
          ? isNull(sandboxes.evaluation_status)
          : eq(sandboxes.evaluation_status, expectedFrom)
      );
    }

    const updated = await db
      .update(sandboxes)
      .set({ evaluation_status: status })
      .where(and(...filters))
      .returning({ uuid: sandboxes.uuid });
    return updated.length > 0;
  }

  /**
   * Résultat d'un run terminé. `evaluated_at` n'est posé qu'ici, et pas par
   * `setEvaluationStatus` : il date le score affiché, pas le lancement.
   */
  async storeEvaluation(
    uuid: string,
    evaluation: unknown,
    status: SandboxEvaluationStatus = "done"
  ): Promise<Sandbox | null> {
    const [updated] = await db
      .update(sandboxes)
      .set({ evaluation, evaluation_status: status, evaluated_at: new Date() })
      .where(eq(sandboxes.uuid, uuid))
      .returning();
    return updated ? toDomainSandbox(updated) : null;
  }

  /**
   * Sortie définitive d'un sandbox. Sans garde sur le statut courant :
   * archiver un sandbox déjà promu est un geste d'admin légitime (le challenge
   * issu de la promotion, lui, continue de vivre), et `promoted_challenge_id`
   * reste posé pour que le lien survive.
   */
  async archive(uuid: string): Promise<Sandbox | null> {
    const [updated] = await db
      .update(sandboxes)
      .set({ status: "archived", updated_at: new Date() })
      .where(eq(sandboxes.uuid, uuid))
      .returning();
    return updated ? toDomainSandbox(updated) : null;
  }
}
