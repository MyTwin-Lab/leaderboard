import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ValidationChallengeService,
  ValidationTargetError,
  SelfVoteError,
  DuplicateVerdictError,
} from '../../../../../../../../packages/services/challenge/validation-challenge.service';
import { getSessionUser } from '@/lib/auth';

const service = new ValidationChallengeService();

// Same caps as POST .../validate — the file/response resent here are exactly
// what that call already handled, just persisted this time.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

const castVerdictFieldsSchema = z
  .object({
    contribution_id: z.string().uuid(),
    verdict: z.enum(['works', 'broken']),
    description: z.string().trim().min(1).nullish(),
  })
  .refine((v) => v.verdict !== 'broken' || !!v.description, {
    message: 'A description is required when the verdict is "broken"',
    path: ['description'],
  });

// POST /api/challenges/[id]/validation-verdicts — any logged-in contributor,
// after having seen the target's output via POST .../validate
// multipart/form-data body: contribution_id, verdict, description (optional),
// file (the File the validator dropped), response (the Blob of what the
// endpoint returned, already fetched by the client via .../validate),
// response_content_type, response_status.
// Persisting the run here — not in .../validate — ties the exact bytes to the
// verdict they informed, since a validator may try several files before voting.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;
    const form = await req.formData();

    const parsed = castVerdictFieldsSchema.parse({
      contribution_id: form.get('contribution_id'),
      verdict: form.get('verdict'),
      description: form.get('description') || null,
    });

    const file = form.get('file');
    const response = form.get('response');
    const responseContentType = form.get('response_content_type');
    const responseStatus = form.get('response_status');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!(response instanceof File)) {
      return NextResponse.json({ error: 'response is required' }, { status: 400 });
    }
    if (typeof responseContentType !== 'string' || !responseContentType) {
      return NextResponse.json({ error: 'response_content_type is required' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }
    if (response.size > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'Response too large' }, { status: 413 });
    }

    const parsedStatus = typeof responseStatus === 'string' ? Number(responseStatus) : NaN;

    const result = await service.castVerdict({
      validationChallengeId: challengeId,
      contributionId: parsed.contribution_id,
      validatorUserId: user.id,
      verdict: parsed.verdict,
      description: parsed.description ?? null,
      file: {
        buffer: Buffer.from(await file.arrayBuffer()),
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
      },
      response: {
        status: Number.isFinite(parsedStatus) ? parsedStatus : 200,
        contentType: responseContentType,
        body: Buffer.from(await response.arrayBuffer()),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof SelfVoteError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DuplicateVerdictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error casting validation verdict:', error);
    return NextResponse.json({ error: 'Failed to cast verdict' }, { status: 500 });
  }
}
