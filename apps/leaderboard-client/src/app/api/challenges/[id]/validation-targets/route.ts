import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ChallengeRepository,
  ContributionRepository,
  ValidationTargetRepository,
  ValidationAttemptRepository,
  RewardEntryRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { assertPublicHttpUrl } from '../../../../../../../../packages/services/challenge/ssrf-guard';

const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();
const targetRepo = new ValidationTargetRepository();
const attemptRepo = new ValidationAttemptRepository();
const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();

async function authorize(challengeId: string) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const isAdmin = user.role === 'admin';
  const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
  if (!isAdmin && !isManager) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

// GET /api/challenges/[id]/validation-targets
// Public: the exposed targets + pool state (+ "already validated by me" if logged in).
// ?eligible=true (admin/manager only): api_packaging contributions from the source
// challenge that aren't already a target — the endpoint URL is entered by the
// admin/manager when adding one as a target, not required beforehand.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    if (req.nextUrl.searchParams.get('eligible') === 'true') {
      const auth = await authorize(challengeId);
      if ('error' in auth) return auth.error;

      const sourceContribs = challenge.source_challenge_id
        ? await contributionRepo.findByChallenge(challenge.source_challenge_id)
        : [];
      const existingTargets = await targetRepo.findByChallenge(challengeId);
      const targetedContributionIds = new Set(existingTargets.map(t => t.contribution_id));

      const eligible = sourceContribs.filter(
        c => c.type === 'api_packaging' && !targetedContributionIds.has(c.uuid)
      );
      const users = await userRepo.findByIds([...new Set(eligible.map(c => c.user_id))]);
      const usersById = new Map(users.map(u => [u.uuid, u]));

      return NextResponse.json({
        eligible: eligible.map(c => ({
          contributionId: c.uuid,
          userId: c.user_id,
          userName: usersById.get(c.user_id)?.full_name ?? 'Unknown',
        })),
      });
    }

    const [targets, distributed] = await Promise.all([
      targetRepo.findByChallenge(challengeId),
      rewardRepo.sumByChallenge(challengeId),
    ]);

    const contributions = await Promise.all(targets.map(t => contributionRepo.findById(t.contribution_id)));
    const submitterIds = [...new Set(contributions.filter((c): c is NonNullable<typeof c> => !!c).map(c => c.user_id))];
    const submitters = await userRepo.findByIds(submitterIds);
    const submittersById = new Map(submitters.map(u => [u.uuid, u]));

    const session = await getSessionUser();
    const myAttempts = session
      ? await attemptRepo.findByChallengeAndValidator(challengeId, session.id)
      : [];
    const validatedContributionIds = new Set(myAttempts.map(a => a.contribution_id));

    const isManager = session
      ? session.role === 'admin' || (await isManagerOfChallenge(session.id, challengeId))
      : false;

    const attemptsByTarget = await Promise.all(
      targets.map(t => attemptRepo.findByChallengeAndContribution(challengeId, t.contribution_id))
    );

    const pool = challenge.contribution_points_reward;

    return NextResponse.json({
      currentUserId: session?.id ?? null,
      pool: {
        pool,
        distributed,
        remaining: Math.max(0, pool - distributed),
        cpPerValidation: challenge.cp_per_validation ?? 0,
        requiredValidations: challenge.required_validations ?? 0,
      },
      targets: targets.map((t, i) => {
        const c = contributions[i];
        const submitter = c ? submittersById.get(c.user_id) : undefined;
        const attempts = attemptsByTarget[i];
        const worksCount = attempts.filter(a => a.verdict === 'works').length;
        const brokenCount = attempts.length - worksCount;
        return {
          id: t.uuid,
          contributionId: t.contribution_id,
          submitterUserId: c?.user_id ?? null,
          submitterName: submitter?.full_name ?? 'Unknown',
          submitterAvatarUrl: submitter?.avatar_url ?? null,
          alreadyValidatedByMe: validatedContributionIds.has(t.contribution_id),
          verdictCount: attempts.length,
          outcome: t.outcome,
          resolvedAt: t.resolved_at,
          // Only the manager sees the live split before resolution — everyone
          // else gets a blind participation count, so their own verdict is an
          // independent judgment, not a reaction to the running tally.
          ...(isManager ? { worksCount, brokenCount } : {}),
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching validation targets:', error);
    return NextResponse.json({ error: 'Failed to fetch validation targets' }, { status: 500 });
  }
}

const addTargetSchema = z.object({
  contribution_id: z.string().uuid(),
  live_endpoint_url: z.string().url(),
});

// POST /api/challenges/[id]/validation-targets — admin/manager only
// Selects an api_packaging submission (traceability — who gets credited) and
// records the endpoint to test, entered by the admin/manager at this point
// rather than declared beforehand by the contributor.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const auth = await authorize(challengeId);
    if ('error' in auth) return auth.error;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const body = await req.json();
    const { contribution_id, live_endpoint_url } = addTargetSchema.parse(body);

    const contribution = await contributionRepo.findById(contribution_id);
    if (
      !contribution ||
      contribution.challenge_id !== challenge.source_challenge_id ||
      contribution.type !== 'api_packaging'
    ) {
      return NextResponse.json({ error: 'Contribution is not an eligible api_packaging submission' }, { status: 400 });
    }

    const existing = await targetRepo.findByChallengeAndContribution(challengeId, contribution_id);
    if (existing) {
      return NextResponse.json({ error: 'Already exposed on this validation challenge' }, { status: 409 });
    }

    try {
      await assertPublicHttpUrl(live_endpoint_url);
    } catch (err) {
      return NextResponse.json(
        { error: `Endpoint URL is not reachable/allowed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 400 }
      );
    }

    await contributionRepo.update(contribution_id, { live_endpoint_url });
    const target = await targetRepo.create({ validation_challenge_id: challengeId, contribution_id, position: 0 });
    return NextResponse.json(target, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    console.error('Error adding validation target:', err);
    return NextResponse.json({ error: 'Failed to add validation target' }, { status: 500 });
  }
}
