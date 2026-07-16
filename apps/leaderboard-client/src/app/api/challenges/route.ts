import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import {
  ChallengeRepository,
  RepoRepository,
  ChallengeRepoRepository,
} from '../../../../../../packages/database-service/repositories';
import type { ChallengeRepoRole } from '../../../../../../packages/database-service/domain/entities';
import { mlRewardRulesSchema } from '../../../../../../packages/database-service/domain/mlRewardRules';
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
  reward_rules: mlRewardRulesSchema.nullish(),
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
    const token = request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;
    const userRole = payload.role as string;

    const body = await request.json();
    const validated = createChallengeSchema.parse(body);

    if (userRole !== 'admin') {
      const project = await repositories.project.findById(validated.project_id);
      if (!project || project.manager_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
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

    // Auto-create repos based on challenge type and link them.
    // ML repos carry an explicit role: the model step has two repos (Kaggle +
    // GitHub) and both are typed 'github'/'kaggle_model', so the type alone can
    // no longer tell the model's code repo from the API packaging one.
    const repoDefinitions: {
      title: string;
      type: string;
      role?: ChallengeRepoRole;
      external_repo_id?: string;
    }[] =
      validated.type === 'ml'
        ? [
            { title: `${validated.title} — Dataset`,    type: 'kaggle_dataset', role: 'dataset'    },
            { title: `${validated.title} — Model`,      type: 'kaggle_model',   role: 'model'      },
            { title: `${validated.title} — Model Code`, type: 'github',         role: 'model_code' },
            { title: `${validated.title} — API`,        type: 'github',         role: 'api'        },
          ]
        : [{ title: `${validated.title} — Code`, type: 'github', external_repo_id: githubSlug }];

    await Promise.all(
      repoDefinitions.map(async ({ title, type, role, external_repo_id }) => {
        const repo = await repoRepo.create({ title, type, project_id: validated.project_id, external_repo_id });
        await challengeRepoRepo.create({ challenge_id: challenge.uuid, repo_id: repo.uuid, role });
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
