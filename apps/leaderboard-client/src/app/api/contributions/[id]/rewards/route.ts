import { NextRequest, NextResponse } from 'next/server';
import {
  ContributionRepository,
  RewardEntryRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { ruleKeyLabel } from '../../../../../../../../packages/capabilities/economy';

export const dynamic = 'force-dynamic';

const contributionRepo = new ContributionRepository();
const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();

// GET /api/contributions/[id]/rewards
// The ledger rows behind one contribution's reward — what makes a bare "0 CP"
// or a silently growing total legible.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contributionId } = await params;

    const contribution = await contributionRepo.findById(contributionId);
    if (!contribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    const entries = await rewardRepo.findByContribution(contributionId);

    // Resolve the counterparty of each reuse row, so the UI can say
    // "40 CP to Alice" rather than showing a raw uuid.
    const counterpartyIds = [
      ...new Set(entries.map(e => e.source_user_id).filter((id): id is string => !!id)),
    ];
    const users = await userRepo.findByIds(counterpartyIds);
    const nameById = Object.fromEntries(users.map(u => [u.uuid, u.full_name]));

    return NextResponse.json({
      contributionId,
      total: entries.reduce((sum, e) => sum + e.points, 0),
      evaluationStatus: contribution.evaluation_status ?? null,
      entries: entries
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .map(e => ({
          ruleKey: e.rule_key,
          // The label is declared by whoever owns the key — a static label, or
          // one read from the row (a signal named by the manager).
          label: ruleKeyLabel(e.rule_key, e.meta),
          points: e.points,
          counterparty: e.source_user_id ? nameById[e.source_user_id] ?? null : null,
          // Pas de `meta` : il porte l'extrait Slack et la justification du LLM
          // (ou l'agentScore ML), et cette route est publique — voir
          // lib/routeVisibility.ts. Le libellé ci-dessus en est la seule part lisible.
          createdAt: e.created_at.toISOString(),
        })),
    });
  } catch (error) {
    console.error('Error fetching contribution rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}
