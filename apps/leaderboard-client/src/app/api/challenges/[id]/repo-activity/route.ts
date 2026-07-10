import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository } from '../../../../../../../../packages/database-service/repositories';
import { ConnectorRegistry } from '../../../../../../../../packages/connectors/registry.js';
import type { RepoActivity } from '../../../../../../../../packages/connectors/interfaces.js';

const challengeRepoRepo = new ChallengeRepoRepository();

// GET /api/challenges/[id]/repo-activity
// Returns fetchRepoActivity() results for all repos in the challenge, keyed by repo_id.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);

    const results = await Promise.allSettled(
      repos.map(async (repo) => {
        // findByChallengeWithRepo returns { repo_type, repo_external_id } but
        // createConnector expects { type, external_repo_id } — remap explicitly.
        const repoForConnector = {
          ...repo,
          type: repo.repo_type,
          external_repo_id: repo.repo_external_id,
        };
        const connector = ConnectorRegistry.createConnector(repoForConnector as any);
        if (!connector || typeof connector.fetchRepoActivity !== 'function') {
          return { repo_id: repo.repo_id, result: { error: 'No activity method available' } };
        }
        try {
          const activity: RepoActivity = await connector.fetchRepoActivity!();
          return { repo_id: repo.repo_id, result: activity };
        } catch (err: any) {
          return { repo_id: repo.repo_id, result: { error: err?.message ?? 'Unknown error' } };
        }
      })
    );

    const activities: Record<string, RepoActivity | { error: string }> = {};
    for (const settled of results) {
      if (settled.status === 'fulfilled') {
        activities[settled.value.repo_id] = settled.value.result;
      }
    }

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching repo activity:', error);
    return NextResponse.json({ error: 'Failed to fetch repo activity' }, { status: 500 });
  }
}
