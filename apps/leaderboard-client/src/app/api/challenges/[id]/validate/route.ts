import { NextRequest, NextResponse } from 'next/server';
import {
  ValidationChallengeService,
  ValidationTargetError,
  EndpointCallError,
  SelfVoteError,
} from '../../../../../../../../packages/services/challenge/validation-challenge.service';
import { getSessionUser } from '@/lib/auth';

const service = new ValidationChallengeService();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// POST /api/challenges/[id]/validate — any logged-in contributor
// multipart/form-data body: contribution_id (string), file (File)
// Pure proxy: calls the target's endpoint and returns its raw response.
// Casting a verdict on what came back is a separate call — see
// POST .../validation-verdicts.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;

    const form = await req.formData();
    const contributionId = form.get('contribution_id');
    const file = form.get('file');

    if (typeof contributionId !== 'string' || !contributionId) {
      return NextResponse.json({ error: 'contribution_id is required' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await service.validate({
      validationChallengeId: challengeId,
      contributionId,
      validatorUserId: user.id,
      file: { buffer, filename: file.name, mimeType: file.type || 'application/octet-stream' },
    });

    return new NextResponse(new Uint8Array(result.body), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'X-Validation-Status': String(result.status),
      },
    });
  } catch (error) {
    if (error instanceof SelfVoteError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ValidationTargetError) {
      console.error('Validation target error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof EndpointCallError) {
      console.error('Validation endpoint call error:', error.message);
      return NextResponse.json({ error: `The API didn't respond correctly: ${error.message}` }, { status: 502 });
    }
    console.error('Error running validation:', error);
    return NextResponse.json({ error: 'Failed to run validation' }, { status: 500 });
  }
}
