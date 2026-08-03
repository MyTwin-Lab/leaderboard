import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepository, ValidationAttemptRepository } from '../../../../../../../packages/database-service/repositories';
import { mlRewardRulesSchema } from '../../../../../../../packages/database-service/domain/mlRewardRules';
import { verifyRequestToken } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const attemptRepo = new ValidationAttemptRepository();

const updateChallengeSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative().optional(),
  project_id: z.string().uuid().optional(),
  reward_rules: mlRewardRulesSchema.nullish(),
  compute_enabled: z.boolean().optional(),
});

// GET /api/challenges/[id] - Récupérer un challenge
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challenge = await challengeRepo.findById(id);
    
    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(challenge);
  } catch (error) {
    console.error('Error fetching challenge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenge' },
      { status: 500 }
    );
  }
}

// PUT /api/challenges/[id] - Mettre à jour un challenge
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyRequestToken(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const isAdmin = session.role === 'admin';
    const isManager = !isAdmin && await isManagerOfChallenge(session.userId, id);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const before = await challengeRepo.findById(id);

    const body = await request.json();
    const validated = updateChallengeSchema.parse(body);

    const updateData: any = { ...validated };
    // Present but empty means "clear the date"; absent means "leave it alone".
    if (validated.start_date !== undefined) updateData.start_date = validated.start_date ? new Date(validated.start_date) : null;
    if (validated.end_date !== undefined) updateData.end_date = validated.end_date ? new Date(validated.end_date) : null;

    const challenge = await challengeRepo.update(id, updateData);

    // Purge the file/response blobs of every validation run once the
    // validation challenge itself archives — verdict/description/metadata
    // stay for the CP audit trail, only the binary content is dropped.
    if (before?.type === 'validation' && before.status !== 'archived' && validated.status === 'archived') {
      try {
        await attemptRepo.purgeContentForChallenge(id);
      } catch (err) {
        console.error('Error purging validation attempt content on archive:', err);
      }
    }

    // Closing an ML challenge cuts any still-active GPU compute instance
    // immediately, regardless of how much of its 24h window is left — same
    // "completed/archived" set ChallengeManageView treats as closed.
    const CLOSED_STATUSES = ['completed', 'archived'];
    const wasOpen = !CLOSED_STATUSES.includes(before?.status ?? '');
    const isNowClosed = CLOSED_STATUSES.includes(validated.status ?? '');
    if (before?.type === 'ml' && wasOpen && isNowClosed) {
      // Best-effort and fully isolated from the challenge update itself — a
      // failure here (constructor throw, DB error, Scaleway API error) must
      // never turn a successful status change into a 500.
      try {
        const { ComputeRequestService } = await import('../../../../../../../packages/services/compute/compute-request.service.js');
        new ComputeRequestService().terminateForChallenge(id, 'challenge_closed').catch(err => {
          console.error('Error terminating compute requests on challenge close:', err);
        });
      } catch (err) {
        console.error('Error terminating compute requests on challenge close:', err);
      }
    }

    return NextResponse.json(challenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error updating challenge:', error);
    return NextResponse.json(
      { error: 'Failed to update challenge' },
      { status: 500 }
    );
  }
}

// DELETE /api/challenges/[id] - Supprimer un challenge
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cut any active GPU compute instance *before* the challenge row is
    // deleted — compute_requests.challenge_id cascades on delete, so doing
    // this after would drop the rows before their instances could be reached.
    const { ComputeRequestService } = await import('../../../../../../../packages/services/compute/compute-request.service.js');
    await new ComputeRequestService().terminateForChallenge(id, 'challenge_deleted');

    await challengeRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting challenge:', error);
    return NextResponse.json(
      { error: 'Failed to delete challenge' },
      { status: 500 }
    );
  }
}
