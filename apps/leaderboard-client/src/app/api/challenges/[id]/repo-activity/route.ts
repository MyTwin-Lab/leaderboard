import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository } from '../../../../../../../../packages/database-service/repositories';
import { ConnectorRegistry } from '../../../../../../../../packages/connectors/registry.js';
import { extractArtifactRef } from '../../../../../../../../packages/services/challenge/artifactUrl.js';
import type { RepoActivity, KaggleRepoActivity } from '../../../../../../../../packages/connectors/interfaces.js';

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
        // Datasets are not displayed in the Metrics tab — skip them entirely.
        if (repo.repo_type === 'kaggle_dataset') {
          return { repo_id: repo.repo_id, result: { error: 'No activity method available' } };
        }

        // If no external_repo_id but users have submitted URLs, derive refs from those URLs.
        // This covers any repo type where contributors each submit their own artifact URL
        // (e.g. Kaggle models in ML challenges) rather than sharing a single repo ref.
        if (!repo.repo_external_id) {
          const userUrls = (repo.workspace_meta as { userUrls?: Record<string, string> } | null)?.userUrls ?? {};
          const uniqueRefs = new Set<string>();
          for (const url of Object.values(userUrls)) {
            const ref = extractArtifactRef(url);
            if (ref) uniqueRefs.add(ref);
          }

          if (uniqueRefs.size === 0) {
            return { repo_id: repo.repo_id, result: { error: 'No activity method available' } };
          }

          const aggregated: KaggleRepoActivity = { type: repo.repo_type as KaggleRepoActivity['type'], modelVersions: [] };

          await Promise.allSettled(
            [...uniqueRefs].map(async (ref) => {
              const connector = await ConnectorRegistry.createConnector({
                ...repo,
                type: repo.repo_type,
                external_repo_id: ref,
              } as any);
              if (!connector || typeof connector.fetchRepoActivity !== 'function') return;
              try {
                const activity = await connector.fetchRepoActivity!() as KaggleRepoActivity;
                if (activity.datasetMeta) {
                  aggregated.datasetMeta = activity.datasetMeta;
                }
                if (activity.modelVersions) {
                  aggregated.modelVersions = [...(aggregated.modelVersions ?? []), ...activity.modelVersions];
                }
              } catch {
                // skip failed refs silently
              }
            })
          );

          return { repo_id: repo.repo_id, result: aggregated };
        }

        // Repo has a fixed external_repo_id: use it directly.
        const repoForConnector = {
          ...repo,
          type: repo.repo_type,
          external_repo_id: repo.repo_external_id,
        };
        const connector = await ConnectorRegistry.createConnector(repoForConnector as any);
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
