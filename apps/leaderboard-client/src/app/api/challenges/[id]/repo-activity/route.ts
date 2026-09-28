import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository, ChallengeRepository } from '../../../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';
import { isPubliclyVisible } from '@/lib/public/challengeVisibility';
import { toPublicRepoActivity } from '@/lib/public/repoActivity';
import { ConnectorRegistry } from '../../../../../../../../packages/connectors/registry.js';
import { extractArtifactRef } from '../../../../../../../../packages/services/challenge/artifactUrl.js';
import type { ConnectorActivity } from '../../../../../../../../packages/connectors/interfaces.js';

const challengeRepoRepo = new ChallengeRepoRepository();
const challengeRepo = new ChallengeRepository();

const NO_ACTIVITY = { error: 'No activity method available' };

// GET /api/challenges/[id]/repo-activity
// L'activité de chaque dépôt du challenge, par repo_id, dans l'enveloppe
// `{ connectorKey, payload }` : seul le connecteur connaît la forme du payload.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    // Même garde que /overview : sans session, un challenge non publié est
    // introuvable, sinon son activité resterait lisible par cette porte.
    const session = await verifyRequestToken(request);
    if (!session) {
      const challenge = await challengeRepo.findById(challengeId);
      if (!challenge || !isPubliclyVisible(challenge)) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
      }
    }

    const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);

    const results = await Promise.allSettled(
      repos.map(async (repo) => {
        // Le connecteur dit quels types de dépôt ont une activité à lire.
        const definition = ConnectorRegistry.definitionFor(repo.repo_type);
        const readable = definition?.activity?.repoTypes ?? definition?.repoTypes ?? [];
        if (!definition || !readable.includes(repo.repo_type)) {
          return { repo_id: repo.repo_id, result: NO_ACTIVITY };
        }

        // Sans référence partagée, chaque contributeur soumet son propre
        // artefact : on lit chacun, puis le connecteur fusionne leurs activités.
        if (!repo.repo_external_id) {
          const userUrls = (repo.workspace_meta as { userUrls?: Record<string, string> } | null)?.userUrls ?? {};
          const uniqueRefs = new Set<string>();
          for (const url of Object.values(userUrls)) {
            const ref = extractArtifactRef(url);
            if (ref) uniqueRefs.add(ref);
          }

          if (uniqueRefs.size === 0 || !definition.activity?.merge) {
            return { repo_id: repo.repo_id, result: NO_ACTIVITY };
          }

          const payloads: unknown[] = [];
          await Promise.allSettled(
            [...uniqueRefs].map(async (ref) => {
              const connector = await ConnectorRegistry.createConnector({
                ...repo,
                type: repo.repo_type,
                external_repo_id: ref,
              } as any);
              if (!connector || typeof connector.fetchRepoActivity !== 'function') return;
              try {
                payloads.push((await connector.fetchRepoActivity()).payload);
              } catch {
                // skip failed refs silently
              }
            })
          );

          const merged: ConnectorActivity = { connectorKey: definition.key, payload: definition.activity.merge(payloads) };
          return { repo_id: repo.repo_id, result: merged };
        }

        // Repo has a fixed external_repo_id: use it directly.
        const connector = await ConnectorRegistry.createConnector({
          ...repo,
          type: repo.repo_type,
          external_repo_id: repo.repo_external_id,
        } as any);
        if (!connector || typeof connector.fetchRepoActivity !== 'function') {
          return { repo_id: repo.repo_id, result: NO_ACTIVITY };
        }
        try {
          return { repo_id: repo.repo_id, result: await connector.fetchRepoActivity() };
        } catch (err: any) {
          return { repo_id: repo.repo_id, result: { error: err?.message ?? 'Unknown error' } };
        }
      })
    );

    const activities: Record<string, ConnectorActivity | { error: string }> = {};
    for (const settled of results) {
      if (settled.status === 'fulfilled') {
        activities[settled.value.repo_id] = settled.value.result;
      }
    }

    return NextResponse.json({
      activities: session
        ? activities
        : toPublicRepoActivity(activities, (connectorKey) => ConnectorRegistry.get(connectorKey)?.activity?.toPublic),
    });
  } catch (error) {
    console.error('Error fetching repo activity:', error);
    return NextResponse.json({ error: 'Failed to fetch repo activity' }, { status: 500 });
  }
}
