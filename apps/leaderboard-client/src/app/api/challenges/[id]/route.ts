import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepository } from '../../../../../../../packages/database-service/repositories';
import {
  FlowConfigError,
  parseFlowRules,
  patchExtensionConfig,
} from '../../../../../../../packages/capabilities/flow-config';
import { verifyRequestToken } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { slugField, slugTakenResponse } from '@/lib/server/slugs';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();

const updateChallengeSchema = z.object({
  title: z.string().min(1).optional(),
  // Modifié, l'ancien slug reste une redirection (voir ChallengeRepository.update).
  slug: slugField.optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative().optional(),
  project_id: z.string().uuid().optional(),
  // Lues plus bas par le parseur du flow du challenge (pas une union zod de
  // schémas de packages — l'app et les packages résolvent des instances zod
  // différentes, ce qui casse les vérifications structurelles de tsc).
  reward_rules: z.unknown().nullish(),
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
    if (!before) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateChallengeSchema.parse(body);

    const { compute_enabled, ...fields } = validated;
    const updateData: any = { ...fields };
    // Present but empty means "clear the date"; absent means "leave it alone".
    if (validated.start_date !== undefined) updateData.start_date = validated.start_date ? new Date(validated.start_date) : null;
    if (validated.end_date !== undefined) updateData.end_date = validated.end_date ? new Date(validated.end_date) : null;

    // Same rule: present-but-null clears the rules, absent leaves them alone.
    // Their shape belongs to the challenge's flow, which parses them.
    if (validated.reward_rules !== undefined) {
      const rewardRules = parseFlowRules(before.type, validated.reward_rules);
      if (!rewardRules.ok) {
        return NextResponse.json({ error: 'Invalid reward_rules' }, { status: 400 });
      }
      updateData.reward_rules = rewardRules.rules;
    }

    // La puissance de calcul est la configuration éditable de l'extension
    // compute. Le formulaire l'envoie pour tous les types : un challenge dont
    // le flow n'utilise pas l'extension n'a rien à changer.
    if (compute_enabled !== undefined) {
      try {
        const patched = patchExtensionConfig(before, 'compute', { enabled: compute_enabled });
        if (patched) Object.assign(updateData, patched);
      } catch (error) {
        if (error instanceof FlowConfigError) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        throw error;
      }
    }

    const challenge = await challengeRepo.update(id, updateData);

    // As of challenge-014, archiving a validation challenge no longer purges
    // its evidence automatically — no retention policy has been decided yet
    // (see challenges/challenge-014-qualified_validation/SPEC.md section 4.4),
    // so evidence is kept by default rather than risk losing it before a
    // policy exists. ValidationAttemptRepository.purgeContentForChallenge
    // still exists, available for an explicit future call once that policy
    // is set — it's just no longer wired to this transition.

    // Closing an ML challenge cuts any still-active GPU compute instance
    // immediately, regardless of how much of its 24h window is left — same
    // "completed/archived" set ChallengeManageView treats as closed.
    const CLOSED_STATUSES = ['completed', 'archived'];
    const wasOpen = !CLOSED_STATUSES.includes(before.status ?? '');
    const isNowClosed = CLOSED_STATUSES.includes(validated.status ?? '');
    if (before.type === 'ml' && wasOpen && isNowClosed) {
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
    const slugTaken = slugTakenResponse(error);
    if (slugTaken) return slugTaken;

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
