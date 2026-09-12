import { db, sandbox_stars, sandboxes } from "../db/drizzle";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { toDomainSandboxStar } from "../db/mappers";
import type { SandboxStar } from "../domain/entities";

/**
 * Décision de rattachement d'une identité anonyme à un compte.
 *
 * Paramètre plutôt que règle écrite en dur dans la transaction : la décision
 * est une fonction pure, testable isolément, et elle vit dans la couche
 * service — `planAnonAttach` (`packages/services/sandbox/starAttach.ts`), que
 * `SandboxService.attachAnonStars` passe ici. Le repository ne fournit aucun
 * défaut : il ne peut pas importer la couche service sans inverser les
 * dépendances, et un défaut maison serait une seconde règle à maintenir.
 */
export type AnonAttachPlanner = (
  anonRows: SandboxStar[],
  accountRows: SandboxStar[],
  ownedSandboxIds: string[]
) => { toDelete: string[]; toAttach: string[] };

/**
 * SandboxStarRepository
 * ---------------------
 * Le signal de demande de la plateforme, ouvert aux visiteurs non connectés.
 *
 * Deux invariants gouvernent tout ce fichier :
 *
 * 1. **Une identité n'a jamais qu'une ligne par sandbox.** Starer est un upsert
 *    sur l'index unique partiel correspondant à la nature de l'identité, et
 *    unstarer est un soft-delete — jamais un DELETE, sinon une vague
 *    star/unstar ne laisserait aucune trace d'audit et le rate-limit, qui
 *    compte sur `created_at`, ne verrait plus rien.
 *
 * 2. **Une identité anonyme ne voit que ses lignes non rattachées.** Tous les
 *    lookups anonymes portent `user_id IS NULL`. C'est ce qui interdit de
 *    dé-starer la star d'un compte depuis le même navigateur déconnecté — le
 *    cas du poste partagé.
 */
export class SandboxStarRepository {
  /**
   * Star d'un compte. Réactive la ligne si elle avait été retirée : le cycle
   * star → unstar → star réutilise la même ligne, donc le palier déjà payé ne
   * peut pas l'être une seconde fois.
   */
  async upsertUserStar(entry: {
    sandbox_id: string;
    user_id: string;
    ip_hash?: string | null;
  }): Promise<SandboxStar> {
    const [row] = await db
      .insert(sandbox_stars)
      .values({
        sandbox_id: entry.sandbox_id,
        user_id: entry.user_id,
        origin: "account",
        ip_hash: entry.ip_hash ?? null,
      })
      .onConflictDoUpdate({
        target: [sandbox_stars.sandbox_id, sandbox_stars.user_id],
        // Le prédicat de l'index partiel, obligatoire pour que Postgres puisse
        // l'inférer comme arbitre du conflit.
        targetWhere: sql`user_id IS NOT NULL`,
        // COALESCE et non écrasement : une re-star sans haché (purge RGPD déjà
        // passée, en-tête absent) ne doit pas effacer le haché d'audit de la
        // ligne. Seule la purge des 30 jours a vocation à le remettre à NULL.
        set: {
          removed_at: null,
          ip_hash: sql`COALESCE(excluded.ip_hash, ${sandbox_stars.ip_hash})`,
        },
      })
      .returning();
    return toDomainSandboxStar(row);
  }

  /** Star anonyme. `origin` reste 'anonymous' même après rattachement — c'est l'audit. */
  async upsertAnonStar(entry: {
    sandbox_id: string;
    anon_id: string;
    ip_hash?: string | null;
  }): Promise<SandboxStar> {
    const [row] = await db
      .insert(sandbox_stars)
      .values({
        sandbox_id: entry.sandbox_id,
        anon_id: entry.anon_id,
        origin: "anonymous",
        ip_hash: entry.ip_hash ?? null,
      })
      .onConflictDoUpdate({
        target: [sandbox_stars.sandbox_id, sandbox_stars.anon_id],
        targetWhere: sql`user_id IS NULL`,
        // COALESCE et non écrasement : une re-star sans haché (purge RGPD déjà
        // passée, en-tête absent) ne doit pas effacer le haché d'audit de la
        // ligne. Seule la purge des 30 jours a vocation à le remettre à NULL.
        set: {
          removed_at: null,
          ip_hash: sql`COALESCE(excluded.ip_hash, ${sandbox_stars.ip_hash})`,
        },
      })
      .returning();
    return toDomainSandboxStar(row);
  }

  /**
   * Unstar. Par `uuid` et non par identité : l'appelant vient de résoudre la
   * ligne avec `findActiveForUser`/`findActiveForAnon`, qui portent déjà les
   * gardes de visibilité. Passer par l'uuid évite de les réécrire ici, et donc
   * d'en oublier une.
   *
   * Idempotent : une ligne déjà retirée n'est pas re-datée, pour que
   * `removed_at` garde la date du premier unstar.
   */
  async softRemove(starUuid: string): Promise<boolean> {
    const removed = await db
      .update(sandbox_stars)
      .set({ removed_at: new Date() })
      .where(and(eq(sandbox_stars.uuid, starUuid), isNull(sandbox_stars.removed_at)))
      .returning({ uuid: sandbox_stars.uuid });
    return removed.length > 0;
  }

  async findActiveForUser(sandboxId: string, userId: string): Promise<SandboxStar | null> {
    const [row] = await db
      .select()
      .from(sandbox_stars)
      .where(
        and(
          eq(sandbox_stars.sandbox_id, sandboxId),
          eq(sandbox_stars.user_id, userId),
          isNull(sandbox_stars.removed_at)
        )
      );
    return row ? toDomainSandboxStar(row) : null;
  }

  /**
   * `user_id IS NULL` n'est pas une optimisation : c'est la garde du §1.5. Une
   * star rattachée à un compte devient invisible pour l'identité anonyme du
   * même navigateur, donc intouchable sans être connecté à ce compte.
   */
  async findActiveForAnon(sandboxId: string, anonId: string): Promise<SandboxStar | null> {
    const [row] = await db
      .select()
      .from(sandbox_stars)
      .where(
        and(
          eq(sandbox_stars.sandbox_id, sandboxId),
          eq(sandbox_stars.anon_id, anonId),
          isNull(sandbox_stars.user_id),
          isNull(sandbox_stars.removed_at)
        )
      );
    return row ? toDomainSandboxStar(row) : null;
  }

  async countActive(sandboxId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(sandbox_stars)
      .where(and(eq(sandbox_stars.sandbox_id, sandboxId), isNull(sandbox_stars.removed_at)));
    return row?.value ?? 0;
  }

  /** Une requête pour toute une page de listing — évite le N+1 des compteurs. */
  async countActiveBySandboxIds(sandboxIds: string[]): Promise<Map<string, number>> {
    if (sandboxIds.length === 0) return new Map();
    const rows = await db
      .select({ sandbox_id: sandbox_stars.sandbox_id, value: count() })
      .from(sandbox_stars)
      .where(and(inArray(sandbox_stars.sandbox_id, sandboxIds), isNull(sandbox_stars.removed_at)))
      .groupBy(sandbox_stars.sandbox_id);
    // Un sandbox sans star n'a aucune ligne : l'appelant lit `?? 0`.
    return new Map(rows.map((row) => [row.sandbox_id, row.value]));
  }

  /**
   * Volume de stars créées **anonymement** derrière une IP depuis `since`.
   *
   * Compte les lignes retirées elles aussi : sans ça, unstarer suffirait à
   * remettre le compteur de débit à zéro.
   *
   * Ne compte en revanche que `origin = 'anonymous'`, alors que le haché est
   * stocké pour toutes les stars (audit). Le plafond ne s'applique qu'aux
   * anonymes ; l'appliquer à un compteur qui inclut les stars de comptes
   * laisserait un contributeur connecté très actif consommer le quota des
   * visiteurs anonymes de son campus. `origin` est figé à la création, donc
   * une star anonyme rattachée depuis continue de compter comme telle.
   */
  async countCreatedByIpSince(ipHash: string, since: Date): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(sandbox_stars)
      .where(
        and(
          eq(sandbox_stars.ip_hash, ipHash),
          eq(sandbox_stars.origin, "anonymous"),
          gte(sandbox_stars.created_at, since)
        )
      );
    return row?.value ?? 0;
  }

  /**
   * Rattache à un compte les stars laissées par une identité anonyme.
   *
   * Une seule transaction, et les suppressions **avant** la migration :
   * l'index unique `(sandbox_id, user_id)` ne peut donc jamais être violé par
   * une ligne anonyme qui doublonnerait une ligne de compte. Au rejeu il ne
   * reste plus aucune ligne `user_id IS NULL` pour cet `anon_id`, donc les deux
   * étapes sont des no-ops — une connexion interrompue laisse tout ou rien, et
   * la connexion suivante rejoue sans effet.
   *
   * Le compteur d'un sandbox ne peut que baisser à cette occasion (aucune ligne
   * n'est créée), et repasser sous un seuil déjà payé est un état normal :
   * un palier n'est jamais repris.
   */
  async attachAnonToUser(
    anonId: string,
    userId: string,
    plan: AnonAttachPlanner
  ): Promise<{ deleted: number; attached: number }> {
    return db.transaction(async (tx) => {
      const anonRows = (
        await tx
          .select()
          .from(sandbox_stars)
          .where(and(eq(sandbox_stars.anon_id, anonId), isNull(sandbox_stars.user_id)))
      ).map(toDomainSandboxStar);

      if (anonRows.length === 0) return { deleted: 0, attached: 0 };

      const sandboxIds = [...new Set(anonRows.map((row) => row.sandbox_id))];

      const accountRows = (
        await tx
          .select()
          .from(sandbox_stars)
          .where(
            and(eq(sandbox_stars.user_id, userId), inArray(sandbox_stars.sandbox_id, sandboxIds))
          )
      ).map(toDomainSandboxStar);

      const ownedSandboxIds = (
        await tx
          .select({ uuid: sandboxes.uuid })
          .from(sandboxes)
          .where(and(eq(sandboxes.user_id, userId), inArray(sandboxes.uuid, sandboxIds)))
      ).map((row) => row.uuid);

      const { toDelete, toAttach } = plan(anonRows, accountRows, ownedSandboxIds);

      if (toDelete.length > 0) {
        await tx.delete(sandbox_stars).where(inArray(sandbox_stars.uuid, toDelete));
      }
      if (toAttach.length > 0) {
        await tx
          .update(sandbox_stars)
          .set({ user_id: userId, attached_at: new Date() })
          .where(inArray(sandbox_stars.uuid, toAttach));
      }

      return { deleted: toDelete.length, attached: toAttach.length };
    });
  }

  /**
   * Purge RGPD des hachés d'IP au-delà de la rétention. Opportuniste, appelée
   * à chaque écriture de star plutôt que par un cron : le volume est faible et
   * un cron de plus serait un composant de plus à surveiller.
   *
   * Ne supprime pas les lignes : seul le haché est effacé, la star reste.
   */
  async purgeIpHashesOlderThan(cutoff: Date): Promise<number> {
    const purged = await db
      .update(sandbox_stars)
      .set({ ip_hash: null })
      .where(and(isNotNull(sandbox_stars.ip_hash), lt(sandbox_stars.created_at, cutoff)))
      .returning({ uuid: sandbox_stars.uuid });
    return purged.length;
  }

  /**
   * Toutes les lignes d'un sandbox, retirées et rattachées comprises : l'audit
   * d'une vague frauduleuse a besoin de voir ce que le compteur ne montre pas.
   */
  async findForAudit(sandboxId: string): Promise<SandboxStar[]> {
    const rows = await db
      .select()
      .from(sandbox_stars)
      .where(eq(sandbox_stars.sandbox_id, sandboxId))
      .orderBy(desc(sandbox_stars.created_at));
    return rows.map(toDomainSandboxStar);
  }

  /**
   * Suppression réelle, réservée à l'annulation administrative d'une vague de
   * stars. Distincte de `softRemove`, qui est le geste d'un visiteur : ici la
   * ligne n'a jamais eu à exister, il n'y a donc rien à conserver.
   */
  async hardDelete(starUuids: string[]): Promise<number> {
    if (starUuids.length === 0) return 0;
    const deleted = await db
      .delete(sandbox_stars)
      .where(inArray(sandbox_stars.uuid, starUuids))
      .returning({ uuid: sandbox_stars.uuid });
    return deleted.length;
  }
}
