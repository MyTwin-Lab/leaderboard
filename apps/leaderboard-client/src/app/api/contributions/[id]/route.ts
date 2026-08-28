import { NextRequest, NextResponse } from 'next/server';
import { ContributionRepository, RewardEntryRepository } from '../../../../../../../packages/database-service/repositories';
import { verifyRequestToken, getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const contributionRepo = new ContributionRepository();
const rewardRepo = new RewardEntryRepository();

// GET /api/contributions/[id] - Une contribution ; son évaluation (grille + score IA)
// n'est renvoyée qu'à son auteur — le reste (titre, reward, date) reste public,
// comme sur les pages de profil.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contribution = await contributionRepo.findById(id);
    if (!contribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    const payload = await verifyRequestToken(request);
    const isAuthor = payload?.userId === contribution.user_id;

    return NextResponse.json(isAuthor ? contribution : { ...contribution, evaluation: null });
  } catch (error) {
    console.error('Error fetching contribution:', error);
    return NextResponse.json({ error: 'Failed to fetch contribution' }, { status: 500 });
  }
}

// PATCH /api/contributions/[id] - Admin only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await contributionRepo.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    const body = await request.json();

    if (body.type !== undefined) {
      const validTypes = ['code', 'model', 'dataset', 'docs'];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Le reward d'une contribution adossée à la ledger est un cache de
    // SUM(reward_entries.points), maintenu par le trigger Postgres
    // trg_sync_contribution_reward. Un écart écrit ici serait écrasé à la
    // prochaine écriture ledger — on refuse plutôt que de désynchroniser.
    if (body.reward !== undefined && Number(body.reward) !== existing.reward) {
      const ledgerEntries = await rewardRepo.findByContribution(id);
      if (ledgerEntries.length > 0) {
        return NextResponse.json(
          { error: 'Reward is computed from the reward ledger and cannot be edited manually' },
          { status: 400 }
        );
      }
    }

    const updated = await contributionRepo.update(id, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.reward !== undefined && { reward: Number(body.reward) }),
      ...(body.user_id !== undefined && { user_id: body.user_id }),
      ...(body.challenge_id !== undefined && { challenge_id: body.challenge_id }),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating contribution:', error);
    return NextResponse.json({ error: 'Failed to update contribution' }, { status: 500 });
  }
}

// DELETE /api/contributions/[id] - Admin only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await contributionRepo.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    await contributionRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contribution:', error);
    return NextResponse.json({ error: 'Failed to delete contribution' }, { status: 500 });
  }
}
