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
  // Optional: a challenge can be created before its schedule is known.
  // '' from an empty date input means "no date", same as omitting the field.
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative(),
  project_id: z.string().uuid(),
  github_repo: z.string().optional(),
  reward_rules: mlRewardRulesSchema.nullish(),
  source_challenge_id: z.string().uuid().optional(),
  cp_per_validation: z.number().int().positive().optional(),
  required_validations: z.number().int().positive().optional(),
  compute_enabled: z.boolean().optional(),
  // ML only, creation-only: whether to auto-create the API Packaging repo/step.
  // Omitted/true = created (default, unchanged behavior); false = skipped, so
  // the challenge only ever shows Dataset + Model.
  api_packaging_enabled: z.boolean().optional(),
});

// GET /api/challenges - Liste tous les challenges
export async function GET(request: NextRequest) {
  try {
    const managedParam = request.nextUrl.searchParams.get('managed');
    if (managedParam === 'true') {
      const token = request.cookies.get('access_token')?.value;
      if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      let userId: string;
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        userId = payload.userId as string;
      } catch {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
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
    let userId: string;
    let userRole: string;
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      userId = payload.userId as string;
      userRole = payload.role as string;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createChallengeSchema.parse(body);

    if (userRole !== 'admin') {
      const project = await repositories.project.findById(validated.project_id);
      if (!project || project.manager_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (validated.type === 'validation') {
      if (!validated.source_challenge_id) {
        return NextResponse.json({ error: 'source_challenge_id is required for validation challenges' }, { status: 400 });
      }
      if (!validated.cp_per_validation) {
        return NextResponse.json({ error: 'cp_per_validation is required for validation challenges' }, { status: 400 });
      }
      if (!validated.required_validations) {
        return NextResponse.json({ error: 'required_validations is required for validation challenges' }, { status: 400 });
      }
      if (validated.required_validations % 2 === 0) {
        return NextResponse.json({ error: 'required_validations must be odd' }, { status: 400 });
      }
      const source = await challengeRepo.findById(validated.source_challenge_id);
      if (!source || source.type !== 'ml') {
        return NextResponse.json({ error: 'source_challenge_id must reference an ML challenge' }, { status: 400 });
      }
      const allChallenges = await challengeRepo.findAll();
      const alreadyLinked = allChallenges.some(
        c => c.type === 'validation' && c.source_challenge_id === validated.source_challenge_id
      );
      if (alreadyLinked) {
        return NextResponse.json({ error: 'This ML challenge already has a validation challenge' }, { status: 409 });
      }
    }

    const challenge = await challengeRepo.create({
      ...validated,
      start_date: validated.start_date ? new Date(validated.start_date) : null,
      end_date: validated.end_date ? new Date(validated.end_date) : null,
      completion: 0,
      source_challenge_id: validated.type === 'validation' ? validated.source_challenge_id : null,
      cp_per_validation: validated.type === 'validation' ? validated.cp_per_validation : null,
      required_validations: validated.type === 'validation' ? validated.required_validations : null,
      compute_enabled: validated.type === 'ml' ? (validated.compute_enabled ?? false) : false,
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
    // Validation challenges never own repos of their own — they reference an
    // existing ML challenge's submissions instead.
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
            ...(validated.api_packaging_enabled !== false
              ? [{ title: `${validated.title} — API`, type: 'github', role: 'api' as const }]
              : []),
          ]
        : validated.type === 'validation'
          ? []
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
