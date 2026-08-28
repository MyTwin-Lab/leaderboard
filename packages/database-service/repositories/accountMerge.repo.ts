import { db } from "../db/drizzle";
import {
  users,
  projects,
  challenge_teams,
  contributions,
  reward_entries,
  validation_attempts,
  compute_requests,
  tasks,
  evaluation_runs,
  evaluation_grids,
  challenge_documents,
  meeting_participants,
  sync_meetings,
  app_settings,
  onboarding_progress,
} from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainUser } from "../db/mappers";
import type { User } from "../domain/entities";

const ONBOARDING_STEPS = [
  "clicked_challenge",
  "assigned_task",
  "evaluated_contribution",
  "validated_task",
  "joined_meeting",
] as const;

export class AccountMergeRepository {
  /**
   * Fusionne `googleAccountId` (compte fraîchement créé par un premier login
   * Google) dans `placeholderId` (contributeur du seed sans Google associé).
   * Transfère l'identité Google, réassigne tout ce qui référence le compte
   * Google (y compris les FK en RESTRICT qui bloqueraient sinon sa suppression),
   * puis le supprime. `placeholderId` garde son full_name/role/points.
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
      await tx.update(challenge_teams).set({ user_id: p }).where(eq(challenge_teams.user_id, g));
      await tx.update(contributions).set({ user_id: p }).where(eq(contributions.user_id, g));
      await tx.update(reward_entries).set({ user_id: p }).where(eq(reward_entries.user_id, g));
      await tx.update(reward_entries).set({ source_user_id: p }).where(eq(reward_entries.source_user_id, g));
      await tx.update(validation_attempts).set({ validator_user_id: p }).where(eq(validation_attempts.validator_user_id, g));
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
