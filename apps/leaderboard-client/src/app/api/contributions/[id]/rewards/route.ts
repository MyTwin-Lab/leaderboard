import { NextRequest, NextResponse } from 'next/server';
import {
  ContributionRepository,
  RewardEntryRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';

export const dynamic = 'force-dynamic';

const contributionRepo = new ContributionRepository();
const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();

/** Human-readable label per rule, so the UI does not hardcode ledger keys. */
const RULE_LABEL: Record<string, string> = {
  dataset: 'Dataset quality',
  model_metric: 'Model metric',
  model_code: 'Model code',
  beat_best: 'Best model bonus',
  api_packaging: 'API packaging',
  reuse_dataset: 'Dataset reuse',
  reuse_model: 'Model reuse',
  slack_signal: 'Slack signal',
};

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
          // Slack signals are named by the manager — the ledger meta carries
          // the label, unlike ML rules whose labels are static.
          label:
            e.rule_key === 'slack_signal' && typeof e.meta?.signal_label === 'string'
              ? e.meta.signal_label
              : RULE_LABEL[e.rule_key] ?? e.rule_key,
          points: e.points,
          counterparty: e.source_user_id ? nameById[e.source_user_id] ?? null : null,
          meta: e.meta ?? null,
          createdAt: e.created_at.toISOString(),
        })),
    });
  } catch (error) {
    console.error('Error fetching contribution rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}
