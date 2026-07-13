import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository, UserRepository, ContributionRepository } from '../../../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const REPO_TYPE_TO_CONTRIBUTION: Record<string, { type: string; title: string }> = {
  kaggle_dataset: { type: 'dataset',       title: 'Dataset Submission'       },
  kaggle_model:   { type: 'model',         title: 'Model Submission'         },
  github:         { type: 'api_packaging', title: 'API Packaging Submission' },
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

    // Create or update contribution immediately when a URL is submitted
    if (workspace_url !== null) {
      const allRepos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);
      const thisRepo = allRepos.find(r => r.repo_id === repo_id);
      const cfg = thisRepo ? REPO_TYPE_TO_CONTRIBUTION[thisRepo.repo_type] : null;

      if (cfg) {
        const challengeContribs = await contributionRepo.findByChallenge(challengeId);
        const existing = challengeContribs.find(
          c => c.user_id === session.userId && c.type === cfg.type
        );

        if (existing) {
          await contributionRepo.update(existing.uuid, { description: workspace_url });
        } else {
          await contributionRepo.create({
            title: cfg.title,
            type: cfg.type,
            description: workspace_url,
            reward: 0,
            user_id: session.userId,
            challenge_id: challengeId,
            submitted_at: new Date(),
          });
        }
      }
    }

    return NextResponse.json({ repo: updated });
  } catch (error) {
    console.error('Error updating ML workspace:', error);
    return NextResponse.json({ error: 'Failed to update ML workspace' }, { status: 500 });
  }
}
