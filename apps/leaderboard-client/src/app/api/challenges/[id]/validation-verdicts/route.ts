import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ValidationChallengeService,
  ValidationTargetError,
  SelfVoteError,
  DuplicateVerdictError,
} from '../../../../../../../../packages/services/challenge/validation-challenge.service';
import { getSessionUser } from '@/lib/auth';

const service = new ValidationChallengeService();

const castVerdictSchema = z
  .object({
    contribution_id: z.string().uuid(),
    verdict: z.enum(['works', 'broken']),
    description: z.string().trim().min(1).nullish(),
  })
  .refine((v) => v.verdict !== 'broken' || !!v.description, {
    message: 'A description is required when the verdict is "broken"',
    path: ['description'],
  });

// POST /api/challenges/[id]/validation-verdicts — any logged-in contributor,
// after having seen the target's output via POST .../validate
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;
    const body = await req.json();
    const parsed = castVerdictSchema.parse(body);

    const result = await service.castVerdict({
      validationChallengeId: challengeId,
      contributionId: parsed.contribution_id,
      validatorUserId: user.id,
      verdict: parsed.verdict,
      description: parsed.description ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof SelfVoteError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DuplicateVerdictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error casting validation verdict:', error);
    return NextResponse.json({ error: 'Failed to cast verdict' }, { status: 500 });
  }
}
