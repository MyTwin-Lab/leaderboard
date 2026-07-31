import { NextRequest, NextResponse } from 'next/server';
import {
  ContributionRepository,
  RewardEntryRepository,
} from '../../../../../../../../packages/database-service/repositories';

const contributionRepo = new ContributionRepository();
const rewardRepo = new RewardEntryRepository();

// GET /api/contributions/challenge/[id] - Contributions d'un challenge
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [contributions, entries] = await Promise.all([
      contributionRepo.findByChallenge(id),
      rewardRepo.findByChallenge(id),
    ]);

    // Build a per-contribution net total from the ledger (source of truth).
    // This overrides the cached contributions.reward column which can be stale
    // or 0 when evaluation is still running.
    const ledgerTotals: Record<string, number> = {};
    for (const e of entries) {
      if (e.contribution_id) {
        ledgerTotals[e.contribution_id] = (ledgerTotals[e.contribution_id] ?? 0) + e.points;
      }
    }

    const result = contributions.map(c => ({
      ...c,
      reward: ledgerTotals[c.uuid] ?? c.reward,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}
