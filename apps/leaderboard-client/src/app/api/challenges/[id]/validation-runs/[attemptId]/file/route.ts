import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ValidationAttemptRepository,
} from '../../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { buildSafeFileHeaders } from '@/lib/server/safeFileHeaders';

const challengeRepo = new ChallengeRepository();
const attemptRepo = new ValidationAttemptRepository();

// GET /api/challenges/[id]/validation-runs/[attemptId]/file — admin/manager only.
// Streams back exactly the file bytes the validator dropped for this run.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  try {
    const { id: challengeId, attemptId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const attempt = await attemptRepo.findById(attemptId);
    if (!attempt || attempt.validation_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    if (!attempt.file_bytes) {
      return NextResponse.json({ error: 'File not available (purged or missing)' }, { status: 410 });
    }

    return new NextResponse(new Uint8Array(attempt.file_bytes), {
      status: 200,
      headers: buildSafeFileHeaders(attempt.file_content_type, attempt.file_filename),
    });
  } catch (error) {
    console.error('Error fetching validation run file:', error);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}
