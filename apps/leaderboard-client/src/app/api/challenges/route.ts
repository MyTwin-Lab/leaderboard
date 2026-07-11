import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import {
  ChallengeRepository,
  RepoRepository,
  ChallengeRepoRepository,
} from '../../../../../../packages/database-service/repositories';
import { repositories } from '@/lib/db';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const repoRepo = new RepoRepository();
const challengeRepoRepo = new ChallengeRepoRepository();

const createChallengeSchema = z.object({
  title: z.string().min(1),
  status: z.string(),
  type: z.string().default('code'),
  start_date: z.string(),
  end_date: z.string(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative(),
  project_id: z.string().uuid(),
  github_repo: z.string().optional(),
});

// GET /api/challenges - Liste tous les challenges
export async function GET(request: NextRequest) {
  try {
    const managedParam = request.nextUrl.searchParams.get('managed');
    if (managedParam === 'true') {
      const token = request.cookies.get('access_token')?.value;
      if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      const userId = payload.userId as string;
      const managedProjects = await repositories.project.findByManagerId(userId);
      const projectIds = new Set(managedProjects.map(p => p.uuid));
      const all = await challengeRepo.findAll();
      return NextResponse.json(all.filter(c => projectIds.has(c.project_id)));
    }

    const challenges = await challengeRepo.findAll();
    return NextResponse.json(challenges);
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

// POST /api/challenges - Créer un nouveau challenge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createChallengeSchema.parse(body);
    
    const challenge = await challengeRepo.create({
      ...validated,
      start_date: new Date(validated.start_date),
      end_date: new Date(validated.end_date),
      completion: 0,
    });

    // Extract owner/repo slug from a GitHub URL or plain slug
    const parseGithubSlug = (input: string): string | undefined => {
      if (!input) return undefined;
      const match = input.match(/github\.com\/([^/?#]+\/[^/?#]+)/);
      if (match) return match[1].replace(/\.git$/, '');
      // Already a slug like "owner/repo"
      if (/^[^/]+\/[^/]+$/.test(input)) return input;
      return undefined;
    };

    const githubSlug = validated.github_repo ? parseGithubSlug(validated.github_repo) : undefined;

    // Auto-create repos based on challenge type and link them
    const repoDefinitions: { title: string; type: string; external_repo_id?: string }[] =
      validated.type === 'ml'
        ? [
            { title: `${validated.title} — Dataset`, type: 'kaggle_dataset' },
            { title: `${validated.title} — Model`,   type: 'kaggle_model'   },
            { title: `${validated.title} — API`,     type: 'github'         },
          ]
        : [{ title: `${validated.title} — Code`, type: 'github', external_repo_id: githubSlug }];

    await Promise.all(
      repoDefinitions.map(async ({ title, type, external_repo_id }) => {
        const repo = await repoRepo.create({ title, type, project_id: validated.project_id, external_repo_id });
        await challengeRepoRepo.create({ challenge_id: challenge.uuid, repo_id: repo.uuid });
      })
    );

    return NextResponse.json(challenge, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating challenge:', error);
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}
