import { db } from "../db/drizzle";
import {
  users,
  projects,
  challenge_teams,
  contributions,
  contribution_members,
  reward_entries,
  validation_attempts,
  validation_case_claims,
  validation_reference_cases,
  validation_scenario_runs,
  compute_requests,
  tasks,
  evaluation_runs,
  evaluation_grids,
  challenge_documents,
  meeting_participants,
  sync_meetings,
  app_settings,
  integration_credentials,
  onboarding_progress,
  onboarding_quest_progress,
  sandboxes,
  sandbox_stars,
  sandbox_rewards,
  notifications,
} from "../db/drizzle";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { toDomainUser } from "../db/mappers";
import type { User } from "../domain/entities";

const ONBOARDING_STEPS = [
  "clicked_challenge",
  "assigned_task",
  "evaluated_contribution",
  "validated_task",
  "joined_meeting",
] as const;

type TeamRow = typeof challenge_teams.$inferSelect;
type TeamFields = Pick<TeamRow, "workspace_provider" | "workspace_ref" | "workspace_url" | "workspace_status" | "group_id">;

/** Même ordre de préférence que la déduplication de db-apply-schema.ts : la row qui porte un workspace gagne. */
function workspaceRank(row: TeamRow): number {
  return (row.workspace_ref ? 2 : 0) + (row.workspace_url ? 1 : 0);
}

export interface ChallengeTeamMergePlan {
  /** Challenges où le compte absorbé a une row alors que le placeholder en a déjà une : sa row saute. */
  dropGoogleChallengeIds: string[];
  /** Champs à reporter sur la row conservée du placeholder. */
  patches: Array<{ challenge_id: string; set: TeamFields }>;
}

/**
 * challenge_teams porte un index unique (challenge_id, user_id) : si les deux
 * comptes participent au même challenge, un simple UPDATE de user_id le viole.
 *
 * On garde la row du placeholder, mais on y reporte le workspace de celle du
 * compte absorbé quand c'est elle qui en porte un — sinon le groupe perdrait
 * sa branche. Le workspace est pris en bloc sur une seule row, jamais champ
 * par champ : mélanger le ref de l'une et l'URL de l'autre pointerait nulle
 * part. Le group_id suit la même row, avec repli sur l'autre.
 */
export function planChallengeTeamMerge(placeholderRows: TeamRow[], googleRows: TeamRow[]): ChallengeTeamMergePlan {
  const plan: ChallengeTeamMergePlan = { dropGoogleChallengeIds: [], patches: [] };

  for (const g of googleRows) {
    if (!g.challenge_id) continue;
    const p = placeholderRows.find((row) => row.challenge_id === g.challenge_id);
    if (!p) continue;

    plan.dropGoogleChallengeIds.push(g.challenge_id);

    const winner = workspaceRank(g) > workspaceRank(p) ? g : p;
    const loser = winner === g ? p : g;
    const set: TeamFields = {
      workspace_provider: winner.workspace_provider,
      workspace_ref: winner.workspace_ref,
      workspace_url: winner.workspace_url,
      workspace_status: winner.workspace_status,
      group_id: winner.group_id ?? loser.group_id,
    };
    const unchanged = (Object.keys(set) as Array<keyof TeamFields>).every((key) => set[key] === p[key]);
    if (!unchanged) plan.patches.push({ challenge_id: g.challenge_id, set });
  }

  return plan;
}

export interface MemberShareMergePlan {
  /** Contributions où les deux comptes ont une part : celle du compte absorbé saute… */
  dropGoogleContributionIds: string[];
  /** …après avoir été ajoutée à celle du placeholder. */
  sums: Array<{ contribution_id: string; share_cp: number }>;
}

/**
 * contribution_members a pour PK (contribution_id, user_id). Deux parts sur
 * la même contribution fusionnent en une, par somme : Σ share_cp ne bouge
 * pas, donc l'invariant lu par le leaderboard tient.
 */
export function planMemberShareMerge(
  placeholderRows: Array<{ contribution_id: string; share_cp: number }>,
  googleRows: Array<{ contribution_id: string; share_cp: number }>
): MemberShareMergePlan {
  const plan: MemberShareMergePlan = { dropGoogleContributionIds: [], sums: [] };
  for (const g of googleRows) {
    const p = placeholderRows.find((row) => row.contribution_id === g.contribution_id);
    if (!p) continue;
    plan.dropGoogleContributionIds.push(g.contribution_id);
    plan.sums.push({ contribution_id: g.contribution_id, share_cp: p.share_cp + g.share_cp });
  }
  return plan;
}

/**
 * Doublons sur une clé d'unicité qui inclut le compte : pour chaque clé
 * présente des deux côtés, une seule row survit — celle du placeholder, sauf
 * si `preferGoogle` dit le contraire. Une clé `null` n'entre en conflit avec
 * rien (index partiels).
 */
export function planKeyedDedupe<T>(
  placeholderRows: T[],
  googleRows: T[],
  keyOf: (row: T) => string | null,
  preferGoogle: (googleRow: T, placeholderRow: T) => boolean = () => false
): { dropPlaceholder: T[]; dropGoogle: T[] } {
  const byKey = new Map<string, T>();
  for (const p of placeholderRows) {
    const key = keyOf(p);
    if (key !== null) byKey.set(key, p);
  }

  const result = { dropPlaceholder: [] as T[], dropGoogle: [] as T[] };
  for (const g of googleRows) {
    const key = keyOf(g);
    const p = key === null ? undefined : byKey.get(key);
    if (!p) continue;
    if (preferGoogle(g, p)) result.dropPlaceholder.push(p);
    else result.dropGoogle.push(g);
  }
  return result;
}

export class AccountMergeRepository {
  /**
   * Fusionne `googleAccountId` (compte fraîchement créé par un premier login
   * Google) dans `placeholderId` (contributeur du seed sans Google associé).
   * Transfère l'identité Google, puis réassigne au placeholder les tables qui
   * référencent le compte Google, avant de supprimer celui-ci.
   * `placeholderId` garde son full_name/role/points.
   *
   * Réassigné : projets, participations (challenge_teams), contributions et
   * parts de groupe (contribution_members), ledgers (reward_entries,
   * sandbox_rewards), validations (attempts, claims, cas de référence,
   * walkthroughs), demandes GPU, tâches, runs et grilles d'évaluation,
   * documents, meetings, réglages, sandboxes et stars, notifications,
   * onboarding. Là où une clé d'unicité inclut le compte, les doublons sont
   * résolus avant l'UPDATE (voir les fonctions plan* ci-dessus).
   *
   * Non réassigné, volontairement : refresh_tokens (partent en cascade, le
   * compte Google se reconnecte) et role_changes (l'historique du compte
   * absorbé n'a pas de sens sur le placeholder).
   *
   * Limite connue : compute_requests est unique par (challenge, user) et
   * n'est pas dédoublonné — une demande peut porter une instance GPU active,
   * qu'on ne supprime pas en silence. Si les deux comptes en ont une sur le
   * même challenge, la fusion échoue et la transaction n'écrit rien.
   */
  async merge(placeholderId: string, googleAccountId: string): Promise<User> {
    return db.transaction(async (tx) => {
      const [googleAccount] = await tx.select().from(users).where(eq(users.uuid, googleAccountId));
      if (!googleAccount) throw new Error("Google account not found");
      if (!googleAccount.google_user_id) throw new Error("Target account has no Google identity to transfer");

      const [placeholder] = await tx.select().from(users).where(eq(users.uuid, placeholderId));
      if (!placeholder) throw new Error("Placeholder account not found");
      if (placeholder.google_user_id) throw new Error("Placeholder already has a Google account linked");

      const g = googleAccountId;
      const p = placeholderId;

      await tx.update(projects).set({ manager_id: p }).where(eq(projects.manager_id, g));

      // challenge_teams — index unique (challenge_id, user_id).
      const teamPlan = planChallengeTeamMerge(
        await tx.select().from(challenge_teams).where(eq(challenge_teams.user_id, p)),
        await tx.select().from(challenge_teams).where(eq(challenge_teams.user_id, g))
      );
      if (teamPlan.dropGoogleChallengeIds.length > 0) {
        await tx.delete(challenge_teams).where(
          and(eq(challenge_teams.user_id, g), inArray(challenge_teams.challenge_id, teamPlan.dropGoogleChallengeIds))
        );
      }
      for (const patch of teamPlan.patches) {
        await tx
          .update(challenge_teams)
          .set(patch.set)
          .where(and(eq(challenge_teams.user_id, p), eq(challenge_teams.challenge_id, patch.challenge_id)));
      }
      await tx.update(challenge_teams).set({ user_id: p }).where(eq(challenge_teams.user_id, g));

      await tx.update(contributions).set({ user_id: p }).where(eq(contributions.user_id, g));

      // contribution_members — PK (contribution_id, user_id). Sans cette
      // réassignation, les parts du compte absorbé partaient en cascade.
      const sharePlan = planMemberShareMerge(
        await tx
          .select({ contribution_id: contribution_members.contribution_id, share_cp: contribution_members.share_cp })
          .from(contribution_members)
          .where(eq(contribution_members.user_id, p)),
        await tx
          .select({ contribution_id: contribution_members.contribution_id, share_cp: contribution_members.share_cp })
          .from(contribution_members)
          .where(eq(contribution_members.user_id, g))
      );
      for (const sum of sharePlan.sums) {
        await tx
          .update(contribution_members)
          .set({ share_cp: sum.share_cp })
          .where(and(eq(contribution_members.user_id, p), eq(contribution_members.contribution_id, sum.contribution_id)));
      }
      if (sharePlan.dropGoogleContributionIds.length > 0) {
        await tx.delete(contribution_members).where(
          and(
            eq(contribution_members.user_id, g),
            inArray(contribution_members.contribution_id, sharePlan.dropGoogleContributionIds)
          )
        );
      }
      await tx.update(contribution_members).set({ user_id: p }).where(eq(contribution_members.user_id, g));

      await tx.update(reward_entries).set({ user_id: p }).where(eq(reward_entries.user_id, g));
      await tx.update(reward_entries).set({ source_user_id: p }).where(eq(reward_entries.source_user_id, g));

      // validation_attempts — index unique (challenge, contribution, validateur).
      // Deux verdicts de la même personne sur la même cible : celui du
      // placeholder reste, l'autre compterait double dans la résolution.
      const attemptKey = (a: { validation_challenge_id: string; contribution_id: string }) =>
        `${a.validation_challenge_id}::${a.contribution_id}`;
      const attemptColumns = {
        uuid: validation_attempts.uuid,
        validation_challenge_id: validation_attempts.validation_challenge_id,
        contribution_id: validation_attempts.contribution_id,
      };
      const attemptDedupe = planKeyedDedupe(
        await tx.select(attemptColumns).from(validation_attempts).where(eq(validation_attempts.validator_user_id, p)),
        await tx.select(attemptColumns).from(validation_attempts).where(eq(validation_attempts.validator_user_id, g)),
        attemptKey
      );
      if (attemptDedupe.dropGoogle.length > 0) {
        await tx.delete(validation_attempts).where(
          inArray(validation_attempts.uuid, attemptDedupe.dropGoogle.map((a) => a.uuid))
        );
      }
      await tx.update(validation_attempts).set({ validator_user_id: p }).where(eq(validation_attempts.validator_user_id, g));

      // Claims et cas de référence : aucune unicité par compte.
      await tx.update(validation_case_claims).set({ validator_user_id: p }).where(eq(validation_case_claims.validator_user_id, g));
      await tx.update(validation_reference_cases).set({ author_user_id: p }).where(eq(validation_reference_cases.author_user_id, g));

      // validation_scenario_runs — index unique (challenge, contribution,
      // validateur). Une walkthrough terminée l'emporte sur un brouillon ; à
      // égalité, celle du placeholder. Les feedbacks de la perdante partent
      // en cascade avec elle.
      const runColumns = {
        uuid: validation_scenario_runs.uuid,
        validation_challenge_id: validation_scenario_runs.validation_challenge_id,
        contribution_id: validation_scenario_runs.contribution_id,
        completed_at: validation_scenario_runs.completed_at,
      };
      const runDedupe = planKeyedDedupe(
        await tx.select(runColumns).from(validation_scenario_runs).where(eq(validation_scenario_runs.validator_user_id, p)),
        await tx.select(runColumns).from(validation_scenario_runs).where(eq(validation_scenario_runs.validator_user_id, g)),
        attemptKey,
        (googleRun, placeholderRun) => googleRun.completed_at !== null && placeholderRun.completed_at === null
      );
      const runsToDrop = [...runDedupe.dropPlaceholder, ...runDedupe.dropGoogle].map((r) => r.uuid);
      if (runsToDrop.length > 0) {
        await tx.delete(validation_scenario_runs).where(inArray(validation_scenario_runs.uuid, runsToDrop));
      }
      await tx.update(validation_scenario_runs).set({ validator_user_id: p }).where(eq(validation_scenario_runs.validator_user_id, g));

      await tx.update(compute_requests).set({ user_id: p }).where(eq(compute_requests.user_id, g));
      await tx.update(compute_requests).set({ decided_by: p }).where(eq(compute_requests.decided_by, g));
      await tx.update(tasks).set({ user_id: p }).where(eq(tasks.user_id, g));
      await tx.update(evaluation_runs).set({ createdBy: p }).where(eq(evaluation_runs.createdBy, g));
      await tx.update(evaluation_grids).set({ created_by: p }).where(eq(evaluation_grids.created_by, g));
      await tx.update(challenge_documents).set({ uploaded_by: p }).where(eq(challenge_documents.uploaded_by, g));
      await tx.update(meeting_participants).set({ user_id: p }).where(eq(meeting_participants.user_id, g));
      await tx.update(sync_meetings).set({ created_by: p }).where(eq(sync_meetings.created_by, g));
      await tx.update(app_settings).set({ updated_by: p }).where(eq(app_settings.updated_by, g));
      await tx.update(app_settings).set({ github_connected_by: p }).where(eq(app_settings.github_connected_by, g));
      await tx.update(app_settings).set({ kaggle_connected_by: p }).where(eq(app_settings.kaggle_connected_by, g));
      await tx.update(app_settings).set({ openai_connected_by: p }).where(eq(app_settings.openai_connected_by, g));
      await tx.update(app_settings).set({ slack_connected_by: p }).where(eq(app_settings.slack_connected_by, g));
      await tx.update(app_settings).set({ scaleway_connected_by: p }).where(eq(app_settings.scaleway_connected_by, g));
      await tx.update(integration_credentials).set({ connected_by: p }).where(eq(integration_credentials.connected_by, g));

      // notifications — index unique partiel (user_id, type, dedupe_key) :
      // la même invitation reçue par les deux comptes n'en fait plus qu'une.
      const notificationColumns = { uuid: notifications.uuid, type: notifications.type, dedupe_key: notifications.dedupe_key };
      const notificationDedupe = planKeyedDedupe(
        await tx
          .select(notificationColumns)
          .from(notifications)
          .where(and(eq(notifications.user_id, p), isNotNull(notifications.dedupe_key))),
        await tx
          .select(notificationColumns)
          .from(notifications)
          .where(and(eq(notifications.user_id, g), isNotNull(notifications.dedupe_key))),
        (n) => (n.dedupe_key ? `${n.type}::${n.dedupe_key}` : null)
      );
      if (notificationDedupe.dropGoogle.length > 0) {
        await tx.delete(notifications).where(
          inArray(notifications.uuid, notificationDedupe.dropGoogle.map((n) => n.uuid))
        );
      }
      await tx.update(notifications).set({ user_id: p }).where(eq(notifications.user_id, g));

      // Sandbox — sans ces réassignations, le ON DELETE CASCADE sur `users`
      // effacerait purement et simplement les propositions du compte absorbé,
      // leurs stars et les CP qu'elles ont payés.
      await tx.update(sandboxes).set({ user_id: p }).where(eq(sandboxes.user_id, g));
      await tx.update(sandbox_rewards).set({ user_id: p }).where(eq(sandbox_rewards.user_id, g));

      // Les stars se dédoublonnent avant d'être migrées : si les deux comptes
      // ont staré le même sandbox, l'UPDATE violerait l'index unique
      // (sandbox_id, user_id). C'est la ligne du compte absorbé qui saute — le
      // placeholder est celui qu'on conserve.
      const placeholderStarred = await tx
        .select({ sandbox_id: sandbox_stars.sandbox_id })
        .from(sandbox_stars)
        .where(eq(sandbox_stars.user_id, p));
      if (placeholderStarred.length > 0) {
        await tx.delete(sandbox_stars).where(
          and(
            eq(sandbox_stars.user_id, g),
            inArray(sandbox_stars.sandbox_id, placeholderStarred.map((row) => row.sandbox_id))
          )
        );
      }
      await tx.update(sandbox_stars).set({ user_id: p }).where(eq(sandbox_stars.user_id, g));

      // Une fusion peut rendre le compte conservé auteur d'un sandbox qu'il
      // avait staré sous son autre identité. Personne ne star son propre
      // sandbox : ces stars sautent, sinon le compteur crédite l'auteur de sa
      // propre voix et un palier pourrait se payer sur elle.
      const ownIds = await tx
        .select({ uuid: sandboxes.uuid })
        .from(sandboxes)
        .where(eq(sandboxes.user_id, p));
      if (ownIds.length > 0) {
        await tx.delete(sandbox_stars).where(
          and(
            eq(sandbox_stars.user_id, p),
            inArray(
              sandbox_stars.sandbox_id,
              ownIds.map((row) => row.uuid)
            )
          )
        );
      }

      const [googleOnboarding] = await tx
        .select()
        .from(onboarding_progress)
        .where(eq(onboarding_progress.user_id, g));
      if (googleOnboarding) {
        const [placeholderOnboarding] = await tx
          .select()
          .from(onboarding_progress)
          .where(eq(onboarding_progress.user_id, p));

        const merged = Object.fromEntries(
          ONBOARDING_STEPS.map((step) => [
            step,
            Boolean(placeholderOnboarding?.[step]) || Boolean(googleOnboarding[step]),
          ])
        );

        if (placeholderOnboarding) {
          await tx.update(onboarding_progress).set(merged).where(eq(onboarding_progress.user_id, p));
        } else {
          await tx.insert(onboarding_progress).values({ user_id: p, ...merged });
        }
      }

      // Les quêtes accomplies sous le compte Google rejoignent le placeholder ;
      // une quête que les deux ont accomplie garde la date du placeholder. Le
      // DELETE de users plus bas cascade les lignes restantes du compte Google.
      const googleQuests = await tx
        .select()
        .from(onboarding_quest_progress)
        .where(eq(onboarding_quest_progress.user_id, g));
      if (googleQuests.length > 0) {
        await tx
          .insert(onboarding_quest_progress)
          .values(googleQuests.map((row) => ({ user_id: p, quest_key: row.quest_key, completed_at: row.completed_at })))
          .onConflictDoNothing();
      }

      // Libère les index uniques (google_user_id, email) avant de les réattribuer
      // au placeholder — cascade au passage les refresh_tokens du compte Google.
      await tx.delete(users).where(eq(users.uuid, g));

      const [updated] = await tx
        .update(users)
        .set({
          google_user_id: googleAccount.google_user_id,
          email: googleAccount.email,
          avatar_url: googleAccount.avatar_url,
        })
        .where(eq(users.uuid, p))
        .returning();

      return toDomainUser(updated);
    });
  }
}
