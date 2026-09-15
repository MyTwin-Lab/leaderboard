import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import {
  ChallengeRepository,
  RepoRepository,
  ChallengeRepoRepository,
  ParentFlowTakenError,
} from '../../../../../../packages/database-service/repositories';
import { creationRepos } from '../../../../../../packages/capabilities/challenge-hooks';
import {
  FlowConfigError,
  parseFlowRules,
  prepareFlowConfig,
} from '../../../../../../packages/capabilities/flow-config';
import { flowsValidating, requiresDeliverable } from '../../../../../../packages/capabilities/deliverables';

/**
 * Compatibilité : un tiroir chargé avant le lot L4c du challenge 020 envoie
 * encore `validation` pour « un challenge de validation », quel que soit son
 * flow. Les formulaires envoient désormais le flow résolu depuis le challenge
 * source (`src/distribution/forms/validation.ts`), que la route revérifie
 * contre les livrables. Ce repli disparaît au lot L7.
 */
const FORM_VALIDATION_TYPE = 'validation';
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
  // Champs de configuration, rangés dans `flow_config` par le flow du
  // challenge (qui ignore ceux qui ne le concernent pas).
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

    if (userRole !== 'admin') {
      const project = await repositories.project.findById(validated.project_id);
      if (!project || project.manager_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Un challenge de validation éprouve les livrables d'un challenge parent.
    // Le formulaire envoie encore `validation` : le flow se déduit alors des
    // livrables du challenge source (un endpoint, une application déployée).
    // Un flow explicite reste accepté s'il sait éprouver ce source. Le quorum
    // et le forfait sont vérifiés par le schéma du flow retenu.
    let flowKey = validated.type;
    if (validated.type === FORM_VALIDATION_TYPE || requiresDeliverable(validated.type)) {
      if (!validated.source_challenge_id) {
        return NextResponse.json({ error: 'source_challenge_id is required for validation challenges' }, { status: 400 });
      }
      if (!validated.cp_per_validation) {
        return NextResponse.json({ error: 'cp_per_validation is required for validation challenges' }, { status: 400 });
      }

      const source = await challengeRepo.findById(validated.source_challenge_id);
      const candidates = source ? flowsValidating(source.type) : [];
      const resolved = validated.type === FORM_VALIDATION_TYPE
        ? (candidates.length === 1 ? candidates[0] : null)
        : (candidates.includes(validated.type) ? validated.type : null);
      if (!resolved) {
        return NextResponse.json(
          { error: 'source_challenge_id must reference a challenge whose deliverables this validation can test' },
          { status: 400 }
        );
      }
      flowKey = resolved;
    }

    // Les règles se lisent avec le parseur du flow du challenge.
    const rewardRules = parseFlowRules(flowKey, validated.reward_rules);
    if (!rewardRules.ok) {
      return NextResponse.json({ error: 'Invalid reward_rules' }, { status: 400 });
    }

    const {
      workspace_mode,
      cp_per_validation,
      required_validations,
      compute_enabled,
      github_repo,
      api_packaging_enabled,
      reward_rules: _rawRules,
      source_challenge_id,
      ...fields
    } = validated;

    // La configuration candidate : le schéma du flow garde ses clés et pose
    // ses défauts, chaque extension attachée valide sa section.
    let storedConfig: ReturnType<typeof prepareFlowConfig>;
    try {
      storedConfig = prepareFlowConfig(flowKey, {
        workspace_mode,
        cp_per_validation,
        required_validations,
        extensions: { compute: { enabled: compute_enabled } },
      });
    } catch (error) {
      if (error instanceof FlowConfigError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    let challenge;
    try {
      challenge = await challengeRepo.create({
        ...fields,
        type: flowKey,
        start_date: validated.start_date ? new Date(validated.start_date) : null,
        end_date: validated.end_date ? new Date(validated.end_date) : null,
        completion: 0,
        reward_rules: rewardRules.rules,
        source_challenge_id: requiresDeliverable(flowKey) ? source_challenge_id : null,
        ...storedConfig,
      });
    } catch (error) {
      // Un challenge parent ne porte qu'un challenge de chaque flow : c'est
      // l'index unique qui tranche, y compris entre deux créations concurrentes.
      if (error instanceof ParentFlowTakenError) {
        return NextResponse.json({ error: 'This challenge already has a validation challenge of this kind' }, { status: 409 });
      }
      throw error;
    }

    // Les dépôts que le flow du challenge et ses extensions déclarent à la
    // création. La promotion d'un sandbox lit la même déclaration.
    const repoDefinitions = creationRepos(challenge, { github_repo, api_packaging_enabled });

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
