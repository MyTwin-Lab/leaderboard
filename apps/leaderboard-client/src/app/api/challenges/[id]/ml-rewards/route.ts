import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  RewardEntryRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { parseMlRewardRules } from '../../../../../../../../packages/database-service/domain/mlRewardRules';

export const dynamic = 'force-dynamic';

const challengeRepo = new ChallengeRepository();
const rewardRepo = new RewardEntryRepository();

// GET /api/challenges/[id]/ml-rewards
// Pool state + per-user breakdown for an ML challenge.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if (challenge.type !== 'ml') {
      return NextResponse.json({ error: 'Not an ML challenge' }, { status: 400 });
    }
    const mlRules = parseMlRewardRules(challenge.reward_rules);

    const entries = await rewardRepo.findByChallenge(challengeId);

    // Reuse rows cancel out (−40 to the reuser, +40 to the author), so summing
    // every row still yields exactly what the pool has paid out.
    const distributed = entries.reduce((sum, e) => sum + e.points, 0);
    const pool = challenge.contribution_points_reward;

    const byUser = new Map<string, number>();
    for (const e of entries) {
      byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + e.points);
    }

    // Best reported metric per contributor — feeds the "beat the leader" timeline.
    // No userId in the response: the timeline only plots values, never names.
    const metric = mlRules
      ? (() => {
          const best = new Map<string, number>();
          for (const e of entries) {
            if (e.rule_key !== 'model_metric') continue;
            const value = e.meta?.metricValue;
            if (typeof value !== 'number') continue;
            if (!best.has(e.user_id) || value > best.get(e.user_id)!) best.set(e.user_id, value);
          }
          return {
            name: mlRules.model.metric.name,
            baseline: mlRules.model.metric.baseline,
            points: [...best.values()].sort((a, b) => b - a),
          };
        })()
      : null;

    // SQL MAX(...) rather than deriving from `metric.points[0]` computed above:
    // this is the exact same source the ml-workspace PATCH gate reads before
    // blocking a submission, so the two can never disagree on "is it reached".
    const bestValue = mlRules ? await rewardRepo.bestMetricValue(challengeId) : null;
    const blockThreshold = mlRules?.model.metric.blockThreshold ?? null;
    const thresholdReached =
      blockThreshold != null && bestValue != null && bestValue >= blockThreshold;

    return NextResponse.json({
      pool,
      distributed,
      remaining: Math.max(0, pool - distributed),
      rules: mlRules ?? null,
      metric,
      bestValue,
      thresholdReached,
      breakdown: [...byUser.entries()]
        .map(([userId, points]) => ({ userId, points }))
        .sort((a, b) => b.points - a.points),
    });
  } catch (error) {
    console.error('Error fetching ML rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch ML rewards' }, { status: 500 });
  }
}
