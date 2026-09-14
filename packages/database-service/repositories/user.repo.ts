import { db } from "../db/drizzle";
import {
  users,
  contributions,
  challenge_teams,
  contribution_members,
  reward_entries,
  tasks,
  meeting_participants,
} from "../db/drizzle";
import { eq, inArray, and, or, gte, lt, ilike } from "drizzle-orm";
import {
  toDomainUser,
  toDomainContribution,
  toDbUser,
  toDomainChallengeTeam,
  toDomainContributionMember,
} from "../db/mappers";
import type { User, Contribution, ChallengeTeam, ContributionMember, UserRole } from "../domain/entities";
import { userSchema } from "../domain/schemas_zod";
import { pickGroupOwner } from "../../services/challenge/groupPolicy.js";
import { buildRoleChange, recordRoleChange } from "./roleChange.repo";
import { anonymizeUserInDigests } from "./digest.repo";

/**
 * Échappe les métacaractères de LIKE/ILIKE (`%`, `_`, et `\` lui-même, le
 * caractère d'échappement par défaut de Postgres). Sans ça, chercher « _ »
 * rend tous les comptes et « % » sert de joker à qui tape dans le champ.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Workspace recopié sur la row du nouveau porteur — valeurs nulles comprises. */
export interface WorkspaceHandover {
  workspace_provider: string | null;
  workspace_ref: string | null;
  workspace_url: string | null;
  workspace_status: string | null;
}

/** Ce qu'un porteur de groupe supprimé transmet à un membre restant, pour un challenge. */
export interface GroupHandover {
  challengeId: string;
  toUserId: string;
  /** Non-null seulement si le compte supprimé portait le workspace du groupe. */
  workspace: WorkspaceHandover | null;
  /** Le board du groupe (tasks.user_id du porteur) suit le workspace. */
  moveBoard: boolean;
  contributionIds: string[];
}

export interface AccountDeletionPlan {
  handovers: GroupHandover[];
  /** Challenges où des co-membres ont des parts mais où personne ne peut reprendre la contribution. */
  conflicts: string[];
}

/**
 * Levée quand supprimer le compte ferait perdre leurs CP à des co-membres sans
 * qu'on puisse transmettre la contribution. La route la traduit en 409.
 */
export class AccountDeletionConflictError extends Error {
  constructor(public readonly challengeIds: string[]) {
    super(
      `Cannot delete this account: group contributions on ${challengeIds.length} challenge(s) have co-members but no remaining group member to take them over`
    );
    this.name = "AccountDeletionConflictError";
  }
}

/**
 * Planifie ce que la suppression d'un compte doit transmettre avant le DELETE.
 *
 * Pure, pour être testée sans base. Le problème qu'elle résout : dans un
 * groupe, `contributions.user_id`, `reward_entries.user_id`, le board et le
 * workspace sont tous ancrés sur le porteur (voir services/challenge/group.ts).
 * Supprimer le porteur les emporterait en cascade, et avec eux les parts de
 * CP de ses co-membres.
 *
 * Pour chaque challenge :
 *   - participation solo, ou groupe où il ne reste personne : rien à
 *     transmettre — sauf si des co-membres ont quand même des parts sur ses
 *     contributions, incohérence qu'on refuse de trancher (conflit) ;
 *   - porteur du groupe : tout part au porteur suivant, désigné par la même
 *     règle que groupPolicy.pickGroupOwner appliquée aux membres restants ;
 *   - simple membre : rien, sa row contribution_members part en cascade et
 *     les parts des autres restent intactes. Si, par incohérence, il est
 *     `user_id` d'une contribution partagée, elle revient au porteur.
 */
export function planAccountDeletion(input: {
  userId: string;
  /** Toutes les rows challenge_teams des challenges où le compte participe. */
  teams: ChallengeTeam[];
  /** Les contributions dont le compte est `user_id`. */
  ownedContributions: Array<Pick<Contribution, "uuid" | "challenge_id">>;
  /** Les parts de ces contributions. */
  members: ContributionMember[];
}): AccountDeletionPlan {
  const { userId, teams, ownedContributions, members } = input;
  const challengeIds = new Set<string>([
    ...teams.filter((t) => t.user_id === userId).map((t) => t.challenge_id),
    ...ownedContributions.map((c) => c.challenge_id),
  ]);

  const plan: AccountDeletionPlan = { handovers: [], conflicts: [] };

  for (const challengeId of challengeIds) {
    const mine = teams.find((t) => t.challenge_id === challengeId && t.user_id === userId);
    const group = mine?.group_id
      ? teams.filter((t) => t.challenge_id === challengeId && t.group_id === mine.group_id)
      : [];
    const others = group.filter((t) => t.user_id !== userId);
    const owned = ownedContributions.filter((c) => c.challenge_id === challengeId);
    const shared = owned.filter((c) =>
      members.some((m) => m.contribution_id === c.uuid && m.user_id !== userId)
    );

    if (others.length === 0) {
      if (shared.length > 0) plan.conflicts.push(challengeId);
      continue;
    }

    const isOwner = pickGroupOwner(group) === userId;
    if (!isOwner && shared.length === 0) continue;

    plan.handovers.push({
      challengeId,
      toUserId: pickGroupOwner(isOwner ? others : group),
      workspace: isOwner && mine
        ? {
            workspace_provider: mine.workspace_provider ?? null,
            workspace_ref: mine.workspace_ref ?? null,
            workspace_url: mine.workspace_url ?? null,
            workspace_status: mine.workspace_status ?? null,
          }
        : null,
      moveBoard: isOwner,
      contributionIds: (isOwner ? owned : shared).map((c) => c.uuid),
    });
  }

  return plan;
}

export class UserRepository {
  async findAll(): Promise<User[]> {
    const rows = await db.select().from(users);
    return rows.map(toDomainUser);
  }

  /**
   * Recherche par nom, pour le sélecteur de coéquipiers du parcours « join ».
   *
   * `ilike` et non une recherche plein texte : la table tient dans quelques
   * centaines de lignes, et un index GIN serait de l'infrastructure pour un
   * problème qui n'existe pas encore.
   *
   * Rend des `User` complets — c'est à la route de n'en publier que ce qu'un
   * lecteur a le droit de voir. Voir `api/contributors/search`, qui construit
   * sa réponse champ par champ pour cette raison.
   */
  async searchByName(term: string, limit = 10): Promise<User[]> {
    const rows = await db
      .select()
      .from(users)
      .where(ilike(users.full_name, `%${escapeLikePattern(term)}%`))
      .orderBy(users.full_name)
      .limit(limit);
    return rows.map(toDomainUser);
  }


  /**
   * Fenêtre [start, end) — bornes half-open, pour qu'une row tombant
   * exactement sur une borne appartienne à exactement un digest.
   */
  async findCreatedBetween(start: Date, end: Date): Promise<User[]> {
    const rows = await db
      .select()
      .from(users)
      .where(and(gte(users.created_at, start), lt(users.created_at, end)));
    return rows.map(toDomainUser);
  }

  async findById(uuid: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.uuid, uuid));
    return row ? toDomainUser(row) : null;
  }

  async findByGithub(username: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.github_username, username));
    return row ? toDomainUser(row) : null;
  }

  async findByGoogleUserId(googleUserId: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.google_user_id, googleUserId));
    return row ? toDomainUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row ? toDomainUser(row) : null;
  }

  async findByIds(uuids: string[]): Promise<User[]> {
    if (uuids.length === 0) return [];
    const rows = await db.select().from(users).where(inArray(users.uuid, uuids));
    return rows.map(toDomainUser);
  }

  async findContributions(uuid: string): Promise<Contribution[]> {
    const rows = await db.select().from(contributions).where(eq(contributions.user_id, uuid));
    return rows.map(toDomainContribution);
  }

  /**
   * `audit` renseigné (création par un admin) : le rôle initial est tracé dans
   * role_changes, dans la même transaction que l'INSERT. Les créations
   * automatiques (inscription Google, seeds) n'en passent pas.
   */
  async create(
    entity: Omit<User, "uuid" | "created_at">,
    audit?: { changedBy: string | null; note?: string | null }
  ): Promise<User> {
    const validated = userSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const dbData = toDbUser(validated);
    if (!audit) {
      const [inserted] = await db.insert(users).values(dbData).returning();
      return toDomainUser(inserted);
    }
    return db.transaction(async (tx) => {
      const [inserted] = await tx.insert(users).values(dbData).returning();
      const draft = buildRoleChange({
        userId: inserted.uuid,
        oldRole: null,
        newRole: inserted.role,
        changedBy: audit.changedBy,
        note: audit.note,
      });
      if (draft) await recordRoleChange(tx, draft);
      return toDomainUser(inserted);
    });
  }

  /**
   * Mise à jour du profil. Le rôle n'y passe volontairement pas : tout
   * changement de rôle doit laisser une trace, donc passer par `updateRole`.
   */
  async update(uuid: string, entity: Partial<Omit<User, "uuid" | "created_at" | "role">>): Promise<User> {
    const validated = userSchema.omit({ uuid: true, created_at: true, role: true }).partial().parse(entity);
    const dbData: Record<string, unknown> = {};
    if (validated.full_name) dbData.full_name = validated.full_name;
    if (validated.github_username !== undefined) dbData.github_username = validated.github_username;
    if (validated.email !== undefined) dbData.email = validated.email;
    if (validated.google_user_id !== undefined) dbData.google_user_id = validated.google_user_id;
    if (validated.bio !== undefined) dbData.bio = validated.bio;
    if (validated.avatar_url !== undefined) dbData.avatar_url = validated.avatar_url;
    const [updated] = await db.update(users)
      .set(dbData)
      .where(eq(users.uuid, uuid))
      .returning();
    return toDomainUser(updated);
  }

  /**
   * Change le rôle et écrit sa trace dans role_changes, dans une seule
   * transaction. Le SELECT … FOR UPDATE fige l'ancien rôle : deux changements
   * concurrents ne peuvent pas tracer la même valeur de départ.
   *
   * `null` si le compte n'existe pas.
   */
  async updateRole(
    uuid: string,
    role: UserRole,
    audit: { changedBy: string | null; note?: string | null }
  ): Promise<User | null> {
    return db.transaction(async (tx) => {
      const [current] = await tx.select().from(users).where(eq(users.uuid, uuid)).for("update");
      if (!current) return null;

      const draft = buildRoleChange({
        userId: uuid,
        oldRole: current.role,
        newRole: role,
        changedBy: audit.changedBy,
        note: audit.note,
      });
      if (!draft) return toDomainUser(current);

      const [updated] = await tx.update(users).set({ role }).where(eq(users.uuid, uuid)).returning();
      await recordRoleChange(tx, draft);
      return toDomainUser(updated);
    });
  }

  /**
   * Supprime un compte, en une transaction :
   *   1. transmet les contributions de groupe, le workspace et le board du
   *      porteur à un membre restant (voir planAccountDeletion), ou lève
   *      AccountDeletionConflictError ;
   *   2. supprime ses lignes meeting_participants — la FK en SET NULL
   *      gardait son google_user_id et son nom affiché ;
   *   3. remplace son nom dans les payloads de digest (la politique promet
   *      que ses données partent avec le compte) ;
   *   4. DELETE. Une FK encore bloquante remonte en 23503, que la route
   *      traduit en 409.
   *
   * `false` si le compte n'existe pas.
   */
  async delete(uuid: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.uuid, uuid)).for("update");
      if (!user) return false;

      const myTeams = await tx.select().from(challenge_teams).where(eq(challenge_teams.user_id, uuid));
      const owned = await tx
        .select({ uuid: contributions.uuid, challenge_id: contributions.challenge_id })
        .from(contributions)
        .where(eq(contributions.user_id, uuid));

      const challengeIds = [
        ...new Set(
          [...myTeams.map((t) => t.challenge_id), ...owned.map((c) => c.challenge_id)]
            .filter((id): id is string => Boolean(id))
        ),
      ];
      const teams = challengeIds.length > 0
        ? await tx.select().from(challenge_teams).where(inArray(challenge_teams.challenge_id, challengeIds))
        : [];
      const members = owned.length > 0
        ? await tx
            .select()
            .from(contribution_members)
            .where(inArray(contribution_members.contribution_id, owned.map((c) => c.uuid)))
        : [];

      const plan = planAccountDeletion({
        userId: uuid,
        teams: teams.map(toDomainChallengeTeam),
        ownedContributions: owned
          .filter((c): c is { uuid: string; challenge_id: string } => Boolean(c.challenge_id)),
        members: members.map(toDomainContributionMember),
      });
      if (plan.conflicts.length > 0) throw new AccountDeletionConflictError(plan.conflicts);

      for (const handover of plan.handovers) {
        if (handover.workspace) {
          await tx
            .update(challenge_teams)
            .set(handover.workspace)
            .where(and(
              eq(challenge_teams.challenge_id, handover.challengeId),
              eq(challenge_teams.user_id, handover.toUserId)
            ));
        }
        if (handover.moveBoard) {
          await tx
            .update(tasks)
            .set({ user_id: handover.toUserId })
            .where(and(eq(tasks.challenge_id, handover.challengeId), eq(tasks.user_id, uuid)));
        }
        if (handover.contributionIds.length > 0) {
          await tx
            .update(contributions)
            .set({ user_id: handover.toUserId })
            .where(inArray(contributions.uuid, handover.contributionIds));
          // Le ledger d'un groupe est lui aussi au nom du porteur : sans ce
          // report, la cascade effacerait les lignes et le trigger de synchro
          // remettrait contributions.reward à zéro.
          await tx
            .update(reward_entries)
            .set({ user_id: handover.toUserId })
            .where(and(
              eq(reward_entries.user_id, uuid),
              inArray(reward_entries.contribution_id, handover.contributionIds)
            ));
        }
      }

      await tx.delete(meeting_participants).where(
        user.google_user_id
          ? or(eq(meeting_participants.user_id, uuid), eq(meeting_participants.google_user_id, user.google_user_id))
          : eq(meeting_participants.user_id, uuid)
      );

      await anonymizeUserInDigests(tx, uuid);

      await tx.delete(users).where(eq(users.uuid, uuid));
      return true;
    });
  }
}
