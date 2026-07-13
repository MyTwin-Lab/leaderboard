import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepoRepository,
  ChallengeRepository,
  ContributionRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const challengeRepoRepo = new ChallengeRepoRepository();
const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();

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

// POST /api/challenges/[id]/ml-validate
// Validates the ML submission: checks all steps have URLs, creates a contribution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: challengeId } = await params;

    const [challenge, repos] = await Promise.all([
      challengeRepo.findById(challengeId),
      challengeRepoRepo.findByChallengeWithRepo(challengeId),
    ]);

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Only validate ML repos (at least one must exist)
    const mlRepos = repos.filter(r =>
      ['kaggle_dataset', 'kaggle_model', 'github'].includes(r.repo_type)
    );

    if (mlRepos.length === 0) {
      return NextResponse.json({ error: 'No ML repos configured for this challenge' }, { status: 400 });
    }

    // Check that every configured ML repo has a URL from this user
    const missing = mlRepos.filter(r => {
      const userUrls = (r.workspace_meta as { userUrls?: Record<string, string> } | null)?.userUrls ?? {};
      return !userUrls[session.userId];
    });

    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'All steps must be completed before validating' },
        { status: 400 }
      );
    }

    // Group repos by contribution type: one contribution per repo type
    const REPO_TYPE_CONFIG: Record<string, { type: string; title: string }> = {
      kaggle_dataset: { type: 'dataset',      title: 'Dataset Submission'      },
      kaggle_model:   { type: 'model',        title: 'Model Submission'        },
      github:         { type: 'api_packaging',  title: 'API Packaging Submission' },
    };

    const grouped = new Map<string, { type: string; title: string; repos: typeof mlRepos }>();
    for (const r of mlRepos) {
      const cfg = REPO_TYPE_CONFIG[r.repo_type];
      if (!cfg) continue;
      if (!grouped.has(r.repo_type)) grouped.set(r.repo_type, { ...cfg, repos: [] });
      grouped.get(r.repo_type)!.repos.push(r);
    }

    const contributions = await Promise.all(
      [...grouped.values()].map(({ type, title, repos }) => {
        const urlLines = repos.map(r => {
          const userUrls = (r.workspace_meta as { userUrls?: Record<string, string> } | null)?.userUrls ?? {};
          return `${r.repo_type}: ${userUrls[session.userId]}`;
        });
        return contributionRepo.create({
          title: `${title} — ${challenge.title}`,
          type,
          description: urlLines.join('\n'),
          reward: 0,
          user_id: session.userId,
          challenge_id: challengeId,
          submitted_at: new Date(),
        });
      })
    );

    return NextResponse.json({ contributions }, { status: 201 });
  } catch (error) {
    console.error('Error validating ML submission:', error);
    return NextResponse.json({ error: 'Failed to validate submission' }, { status: 500 });
  }
}
