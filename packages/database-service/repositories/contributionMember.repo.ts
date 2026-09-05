import { db } from "../db/drizzle";
import { contribution_members } from "../db/drizzle";
import { eq, inArray, sql } from "drizzle-orm";
import { toDomainContributionMember } from "../db/mappers";
import type { ContributionMember } from "../domain/entities";
import { contributionMemberSchema } from "../domain/schemas_zod";

/**
 * ContributionMemberRepository
 * ----------------------------
 * Parts de CP des membres d'un groupe sur une contribution.
 *
 * Une contribution solo n'a aucune row ici : l'absence de membres signifie
 * "tout le reward revient à `contributions.user_id`", ce qui laisse le
 * comportement historique intact sans migration de données. Toute lecture
 * doit donc traiter le vide comme le cas normal, pas comme une anomalie.
 */
export class ContributionMemberRepository {
  async findAll(): Promise<ContributionMember[]> {
    const rows = await db.select().from(contribution_members);
    return rows.map(toDomainContributionMember);
  }

  async findByContribution(contributionId: string): Promise<ContributionMember[]> {
    const rows = await db
      .select()
      .from(contribution_members)
      .where(eq(contribution_members.contribution_id, contributionId));
    return rows.map(toDomainContributionMember);
  }

  /** Parts de plusieurs contributions en une requête — évite le N+1 des listes. */
  async findByContributions(contributionIds: string[]): Promise<ContributionMember[]> {
    if (contributionIds.length === 0) return [];
    const rows = await db
      .select()
      .from(contribution_members)
      .where(inArray(contribution_members.contribution_id, contributionIds));
    return rows.map(toDomainContributionMember);
  }

  /**
   * Contributions de groupe auxquelles un contributeur a participé — y compris
   * celles qu'il n'a pas soumises lui-même. C'est ce que `findByUser` sur les
   * contributions ne peut pas voir, puisque `contributions.user_id` ne porte
   * que le porteur du groupe.
   */
  async findByUser(userId: string): Promise<ContributionMember[]> {
    const rows = await db
      .select()
      .from(contribution_members)
      .where(eq(contribution_members.user_id, userId));
    return rows.map(toDomainContributionMember);
  }

  /**
   * Ajoute un delta de part à chaque membre, en créant la row au besoin.
   *
   * Additif et non remplaçant : le scoring des challenges code est itératif,
   * chaque run ne connaît que le delta de CP qu'il vient d'écrire au ledger.
   * Un membre arrivé après le premier run n'a donc de part que sur ce qui a
   * suivi son arrivée, et Σ share_cp suit `contributions.reward` sans jamais
   * avoir à le recalculer.
   */
  async addShares(rows: ContributionMember[]): Promise<void> {
    if (rows.length === 0) return;
    const validated = rows.map((r) => contributionMemberSchema.parse(r));

    await db
      .insert(contribution_members)
      .values(validated)
      .onConflictDoUpdate({
        target: [contribution_members.contribution_id, contribution_members.user_id],
        set: {
          share_cp: sql`${contribution_members.share_cp} + excluded.share_cp`,
        },
      });
  }

  /** Retire toutes les parts d'une contribution — sert au retour au solo. */
  async deleteByContribution(contributionId: string): Promise<void> {
    await db
      .delete(contribution_members)
      .where(eq(contribution_members.contribution_id, contributionId));
  }
}
