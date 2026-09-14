import { NextRequest, NextResponse } from 'next/server';
import {
  ContributionRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const contributionRepo = new ContributionRepository();

// GET /api/contributions/challenge/[id] - Contributions d'un challenge (admin uniquement)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Même garde que GET /api/contributions : les lignes portent `evaluation`.
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    // contributions.reward is kept in sync with the reward_entries ledger by
    // the trg_sync_contribution_reward trigger (drizzle/0018_reward_ledger_sync_trigger.sql)
    // — no need to recompute it from the ledger here anymore.
    const contributions = await contributionRepo.findByChallenge(id);

    return NextResponse.json(contributions);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}
