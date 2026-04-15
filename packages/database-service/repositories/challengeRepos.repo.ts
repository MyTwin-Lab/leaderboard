import { db } from "../db/drizzle";
import { challenge_repos, challenges, repos } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainChallengeRepo, toDomainChallenge } from "../db/mappers";
import type { ChallengeRepo, Challenge, WorkspaceStatus, WorkspaceMeta } from "../domain/entities";
import { challengeRepoSchema } from "../domain/schemas_zod";

export class ChallengeRepoRepository {
  async findAll(): Promise<ChallengeRepo[]> {
    const rows = await db.select().from(challenge_repos);
    return rows.map(toDomainChallengeRepo);
  }

  async findByChallenge(challengeId: string): Promise<ChallengeRepo[]> {
    const rows = await db.select().from(challenge_repos).where(eq(challenge_repos.challenge_id, challengeId));
    return rows.map(toDomainChallengeRepo);
  }

  /**
   * Récupère tous les challenges liés à un repo
   */
  async findChallengesByRepo(repoId: string): Promise<Challenge[]> {
    const results = await db
      .select({
        challenge: challenges,
      })
      .from(challenge_repos)
      .leftJoin(challenges, eq(challenge_repos.challenge_id, challenges.uuid))
      .where(eq(challenge_repos.repo_id, repoId));
    
    return results.filter(r => r.challenge !== null).map(r => toDomainChallenge(r.challenge!));
  }

  async findByRepo(repoId: string): Promise<ChallengeRepo[]> {
    const rows = await db.select().from(challenge_repos).where(eq(challenge_repos.repo_id, repoId));
    return rows.map(toDomainChallengeRepo);
  }

  async create(entity: ChallengeRepo): Promise<ChallengeRepo> {
    const validated = challengeRepoSchema.parse(entity);
    const [inserted] = await db.insert(challenge_repos).values({
      challenge_id: validated.challenge_id,
      repo_id: validated.repo_id,
    }).returning();
    return toDomainChallengeRepo(inserted);
  }

  async findByChallengeAndRepo(challengeId: string, repoId: string): Promise<ChallengeRepo | null> {
    const [row] = await db
      .select()
      .from(challenge_repos)
      .where(and(eq(challenge_repos.challenge_id, challengeId), eq(challenge_repos.repo_id, repoId)));
    return row ? toDomainChallengeRepo(row) : null;
  }

  async updateWorkspaceStatus(
    challengeId: string,
    repoId: string,
    status: WorkspaceStatus,
    meta?: Partial<WorkspaceMeta>
  ): Promise<ChallengeRepo | null> {
    const existing = await this.findByChallengeAndRepo(challengeId, repoId);
    if (!existing) return null;

    const newMeta = { ...existing.workspace_meta, ...meta };

    const [updated] = await db
      .update(challenge_repos)
      .set({
        workspace_status: status,
        workspace_meta: newMeta,
      })
      .where(and(eq(challenge_repos.challenge_id, challengeId), eq(challenge_repos.repo_id, repoId)))
      .returning();

    return toDomainChallengeRepo(updated);
  }

  async updateWorkspace(
    challengeId: string,
    repoId: string,
    data: Partial<Pick<ChallengeRepo, 'workspace_provider' | 'workspace_ref' | 'workspace_url' | 'workspace_status' | 'workspace_meta'>>
  ): Promise<ChallengeRepo | null> {
    const updateData: Record<string, unknown> = {};
    
    if (data.workspace_provider !== undefined) updateData.workspace_provider = data.workspace_provider;
    if (data.workspace_ref !== undefined) updateData.workspace_ref = data.workspace_ref;
    if (data.workspace_url !== undefined) updateData.workspace_url = data.workspace_url;
    if (data.workspace_status !== undefined) updateData.workspace_status = data.workspace_status;
    if (data.workspace_meta !== undefined) updateData.workspace_meta = data.workspace_meta;

    const [updated] = await db
      .update(challenge_repos)
      .set(updateData)
      .where(and(eq(challenge_repos.challenge_id, challengeId), eq(challenge_repos.repo_id, repoId)))
      .returning();

    return updated ? toDomainChallengeRepo(updated) : null;
  }

  /**
   * Récupère les repos d'un challenge avec les infos du repo
   */
  async findByChallengeWithRepo(challengeId: string): Promise<(ChallengeRepo & { repo_type: string; repo_external_id?: string })[]> {
    const results = await db
      .select({
        challenge_repo: challenge_repos,
        repo: repos,
      })
      .from(challenge_repos)
      .leftJoin(repos, eq(challenge_repos.repo_id, repos.uuid))
      .where(eq(challenge_repos.challenge_id, challengeId));

    return results
      .filter(r => r.repo !== null)
      .map(r => ({
        ...toDomainChallengeRepo(r.challenge_repo),
        repo_type: r.repo!.type,
        repo_external_id: r.repo!.external_repo_id ?? undefined,
      }));
  }

  async delete(challengeId: string, repoId: string): Promise<void> {
    await db.delete(challenge_repos)
      .where(and(eq(challenge_repos.challenge_id, challengeId), eq(challenge_repos.repo_id, repoId)));
  }
}
