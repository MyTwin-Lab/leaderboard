import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ContributionRepository,
  ValidationAttemptRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

export const dynamic = 'force-dynamic';

const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();
const attemptRepo = new ValidationAttemptRepository();
const userRepo = new UserRepository();

// GET /api/challenges/[id]/validation-runs — admin/manager only.
// Every run cast on this validation challenge, across all targets —
// metadata only (no file/response bytes, see the [attemptId]/file and
// [attemptId]/response routes for those).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if (challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const attempts = await attemptRepo.findByChallenge(challengeId);

    const contributionIds = [...new Set(attempts.map(a => a.contribution_id))];
    const contributions = await Promise.all(contributionIds.map(id => contributionRepo.findById(id)));
    const submitterIdByContribution = new Map(
      contributions.filter((c): c is NonNullable<typeof c> => !!c).map(c => [c.uuid, c.user_id])
    );

    const userIds = [...new Set([
      ...[...submitterIdByContribution.values()],
      ...attempts.map(a => a.validator_user_id),
    ])];
    const users = await userRepo.findByIds(userIds);
    const usersById = new Map(users.map(u => [u.uuid, u]));

    return NextResponse.json({
      runs: attempts.map(a => {
        const submitterId = submitterIdByContribution.get(a.contribution_id);
        return {
          id: a.uuid,
          contributionId: a.contribution_id,
          submitterName: (submitterId && usersById.get(submitterId)?.full_name) ?? 'Unknown',
          validatorId: a.validator_user_id,
          validatorName: usersById.get(a.validator_user_id)?.full_name ?? 'Unknown',
          verdict: a.verdict,
          description: a.description,
          createdAt: a.created_at,
          fileFilename: a.file_filename,
          fileContentType: a.file_content_type,
          responseContentType: a.response_content_type,
          responseStatus: a.response_status,
          purged: a.purged_at !== null,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching validation runs:', error);
    return NextResponse.json({ error: 'Failed to fetch validation runs' }, { status: 500 });
  }
}
