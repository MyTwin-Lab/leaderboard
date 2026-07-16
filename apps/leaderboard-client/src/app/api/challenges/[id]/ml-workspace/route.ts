import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository, UserRepository, ContributionRepository } from '../../../../../../../../packages/database-service/repositories';
import type { ChallengeRepoRole } from '../../../../../../../../packages/database-service/domain/entities';
import { normalizeArtifactUrl } from '../../../../../../../../packages/services/challenge/artifactUrl';
import { jwtVerify } from 'jose';

/**
 * Rôle du repo → contribution qu'il alimente.
 *
 * L'étape modèle a deux repos (Kaggle + GitHub) mais une seule contribution :
 * les deux notes s'additionnent sur la même ligne, jusqu'à `model.cap`.
 * `isArtifact` désigne l'URL qui identifie l'étape — c'est elle qui sert à
 * détecter la réutilisation, donc le code du modèle n'en est pas une.
 */
const ROLE_CONFIG: Record<ChallengeRepoRole, {
  contributionType: string;
  title: string;
  isArtifact: boolean;
}> = {
  dataset:    { contributionType: 'dataset',       title: 'Dataset Submission',       isArtifact: true  },
  model:      { contributionType: 'model',         title: 'Model Submission',         isArtifact: true  },
  model_code: { contributionType: 'model',         title: 'Model Submission',         isArtifact: false },
  api:        { contributionType: 'api_packaging', title: 'API Packaging Submission', isArtifact: true  },
};

const challengeRepoRepo = new ChallengeRepoRepository();
const contributionRepo = new ContributionRepository();
const userRepo = new UserRepository();

async function getSession(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch {
    return null;
  }
}

// GET /api/challenges/[id]/ml-workspace
// Returns all repos for the challenge with per-user submitted URLs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    const { id: challengeId } = await params;

    const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);

    // Collect all unique user IDs across all repo submissions
    const allUserIds = new Set<string>();
    for (const r of repos) {
      const userUrls = (r.workspace_meta as { userUrls?: Record<string, string> } | null)?.userUrls ?? {};
      Object.keys(userUrls).forEach(uid => allUserIds.add(uid));
    }

    // Resolve user info for all submitters
    const submitterUsers = await userRepo.findByIds([...allUserIds]);
    const usersMap = Object.fromEntries(
      submitterUsers.map(u => [u.uuid, { fullName: u.full_name, avatarUrl: u.avatar_url ?? undefined }])
    );

    return NextResponse.json({
      currentUserId: session?.userId ?? null,
      repos: repos.map(r => ({
        repo_id: r.repo_id,
        repo_type: r.repo_type,
        repo_external_id: r.repo_external_id,
        role: r.role ?? null,
        workspace_meta: r.workspace_meta ?? {},
      })),
      users: usersMap,
    });
  } catch (error) {
    console.error('Error fetching ML workspace:', error);
    return NextResponse.json({ error: 'Failed to fetch ML workspace' }, { status: 500 });
  }
}

// PATCH /api/challenges/[id]/ml-workspace
// Saves the current user's URL for a specific repo step
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: challengeId } = await params;
    const body = await request.json();
    const { repo_id, workspace_url } = body;

    if (!repo_id || typeof repo_id !== 'string') {
      return NextResponse.json({ error: 'repo_id is required' }, { status: 400 });
    }
    if (workspace_url !== null && (typeof workspace_url !== 'string' || !workspace_url.trim())) {
      return NextResponse.json({ error: 'workspace_url must be a non-empty string or null' }, { status: 400 });
    }

    const existing = await challengeRepoRepo.findByChallengeAndRepo(challengeId, repo_id);
    if (!existing) {
      return NextResponse.json({ error: 'Repo not found for this challenge' }, { status: 404 });
    }

    const existingMeta = (existing.workspace_meta as Record<string, unknown>) ?? {};
    const existingUserUrls = (existingMeta.userUrls as Record<string, string>) ?? {};

    // null = remove the user's URL (reset step)
    const updatedUserUrls = { ...existingUserUrls };
    if (workspace_url === null) {
      delete updatedUserUrls[session.userId];
    } else {
      updatedUserUrls[session.userId] = workspace_url.trim();
    }

    const updatedMeta = { ...existingMeta, userUrls: updatedUserUrls };

    const updated = await challengeRepoRepo.updateWorkspace(challengeId, repo_id, {
      workspace_meta: updatedMeta,
    });

    // Create or update the contribution backing this step
    if (workspace_url !== null && existing.role) {
      const cfg = ROLE_CONFIG[existing.role];
      if (cfg) {
        const url = workspace_url.trim();
        const challengeContribs = await contributionRepo.findByChallenge(challengeId);
        const contribution = challengeContribs.find(
          c => c.user_id === session.userId && c.type === cfg.contributionType
        );

        // The step's description gathers every repo of that step, so a model
        // shows both its Kaggle and GitHub links on one contribution.
        const allRepos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);
        const stepRepos = allRepos.filter(
          r => r.role && ROLE_CONFIG[r.role]?.contributionType === cfg.contributionType
        );
        const description = stepRepos
          .map(r => {
            const urls = (r.workspace_meta as { userUrls?: Record<string, string> } | null)?.userUrls ?? {};
            const u = r.repo_id === repo_id ? url : urls[session.userId];
            return u ? `${r.role}: ${u}` : null;
          })
          .filter(Boolean)
          .join('\n');

        const artifactPatch = cfg.isArtifact
          ? { artifact_url: normalizeArtifactUrl(url) }
          : {};

        if (contribution) {
          await contributionRepo.update(contribution.uuid, {
            description,
            evaluation_status: 'pending',
            ...artifactPatch,
          });
        } else {
          await contributionRepo.create({
            title: cfg.title,
            type: cfg.contributionType,
            description,
            reward: 0,
            user_id: session.userId,
            challenge_id: challengeId,
            submitted_at: new Date(),
            evaluation_status: 'pending',
            ...artifactPatch,
          });
        }

        // Points are awarded live, but the agent call takes tens of seconds —
        // far past this request's budget. Progress is tracked on the
        // contribution's evaluation_status instead.
        const { MlRewardsService } = await import(
          '../../../../../../../../packages/services/challenge/ml-rewards.service'
        );
        new MlRewardsService().scheduleAward({
          challengeId,
          userId: session.userId,
          repoId: repo_id,
          url,
        });
      }
    }

    return NextResponse.json({ repo: updated });
  } catch (error) {
    console.error('Error updating ML workspace:', error);
    return NextResponse.json({ error: 'Failed to update ML workspace' }, { status: 500 });
  }
}
