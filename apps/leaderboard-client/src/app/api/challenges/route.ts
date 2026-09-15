import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import {
  ChallengeRepository,
  RepoRepository,
  ChallengeRepoRepository,
} from '../../../../../../packages/database-service/repositories';
import { buildRepoDefinitions } from '../../../../../../packages/services/challenge/challengeRepos';
import { parseMlRewardRules } from '../../../../../../packages/database-service/domain/mlRewardRules';
import { parseCodeRewardRules } from '../../../../../../packages/database-service/domain/codeRewardRules';
import { validationModeFor } from '../../../../../../packages/services/challenge/validation-mode';
import { repositories } from '@/lib/db';
import { slugField, slugTakenResponse } from '@/lib/server/slugs';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const repoRepo = new RepoRepository();
const challengeRepoRepo = new ChallengeRepoRepository();

const createChallengeSchema = z.object({
  title: z.string().min(1),
  // Absent : dérivé du titre par le repository. Présent : doit être libre (409).
  slug: slugField.optional(),
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
  reward_rules: z.unknown().nullish(),
  workspace_mode: z.enum(['provided_repo', 'own_repo']).optional(),
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
      // Helper partagé : une signature valide ne suffit pas (voir lib/sessionClaims.ts).
      const session = await verifyRequestToken(request);
      if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const userId = session.userId;
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
    const session = await verifyRequestToken(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, role: userRole } = session;

    const body = await request.json();
    const validated = createChallengeSchema.parse(body);

    const rewardRules = validated.reward_rules == null
      ? null
      : parseMlRewardRules(validated.reward_rules) ?? parseCodeRewardRules(validated.reward_rules);
    if (validated.reward_rules != null && !rewardRules) {
      return NextResponse.json({ error: 'Invalid reward_rules' }, { status: 400 });
    }

    if (userRole !== 'admin') {
      const project = await repositories.project.findById(validated.project_id);
      if (!project || project.manager_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Le mode se déduit du type du challenge source, il ne se stocke pas :
    // `ml` -> flux cas de référence, `code` -> flux scénario. Les règles
    // communes (source obligatoire, CP par validation, 1:1) valent dans les
    // deux ; le quorum n'existe que côté ML.
    let validationMode: ReturnType<typeof validationModeFor> = null;
    if (validated.type === 'validation') {
      if (!validated.source_challenge_id) {
        return NextResponse.json({ error: 'source_challenge_id is required for validation challenges' }, { status: 400 });
      }
      if (!validated.cp_per_validation) {
        return NextResponse.json({ error: 'cp_per_validation is required for validation challenges' }, { status: 400 });
      }

      const source = await challengeRepo.findById(validated.source_challenge_id);
      validationMode = validationModeFor(source?.type);
      if (!validationMode) {
        return NextResponse.json(
          { error: 'source_challenge_id must reference an ML or a Code challenge' },
          { status: 400 }
        );
      }

      // Le quorum n'a de sens que face à un endpoint qui répond works/broken.
      // En mode scénario chaque walkthrough complétée paie, il n'y a rien à
      // résoudre — le champ n'est donc ni demandé ni écrit.
      if (validationMode === 'reference_case') {
        if (!validated.required_validations) {
          return NextResponse.json({ error: 'required_validations is required for validation challenges' }, { status: 400 });
        }
        if (validated.required_validations % 2 === 0) {
          return NextResponse.json({ error: 'required_validations must be odd' }, { status: 400 });
        }
      }

      const allChallenges = await challengeRepo.findAll();
      const alreadyLinked = allChallenges.some(
        c => c.type === 'validation' && c.source_challenge_id === validated.source_challenge_id
      );
      if (alreadyLinked) {
        return NextResponse.json({ error: 'This challenge already has a validation challenge' }, { status: 409 });
      }
    }

    const challenge = await challengeRepo.create({
      ...validated,
      start_date: validated.start_date ? new Date(validated.start_date) : null,
      end_date: validated.end_date ? new Date(validated.end_date) : null,
      completion: 0,
      reward_rules: rewardRules,
      source_challenge_id: validated.type === 'validation' ? validated.source_challenge_id : null,
      cp_per_validation: validated.type === 'validation' ? validated.cp_per_validation : null,
      required_validations: validationMode === 'reference_case' ? validated.required_validations : null,
      compute_enabled: validated.type === 'ml' ? (validated.compute_enabled ?? false) : false,
      workspace_mode: validated.type === 'code' ? (validated.workspace_mode ?? 'provided_repo') : null,
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

    // Auto-create repos based on challenge type and link them. La construction
    // vit dans `services/challenge/challengeRepos.ts` : la promotion d'un
    // sandbox crée un challenge sans passer par cette route et doit produire
    // exactement les mêmes repos.
    const repoDefinitions = buildRepoDefinitions({
      type: validated.type,
      title: validated.title,
      workspaceMode: validated.workspace_mode,
      githubSlug,
      apiPackagingEnabled: validated.api_packaging_enabled,
    });

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
    const slugTaken = slugTakenResponse(error);
    if (slugTaken) return slugTaken;

    console.error('Error creating challenge:', error);
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}
