import { NextRequest, NextResponse } from 'next/server';
import {
  ReferenceCaseService,
  InsufficientRoleError,
  ReferenceCaseQuotaError,
  ValidationTargetError,
} from '../../../../../../../../packages/services/challenge/reference-case.service';
import { ReferenceCaseRepository } from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const service = new ReferenceCaseService();
const caseRepo = new ReferenceCaseRepository();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// GET /api/challenges/[id]/validation-reference-cases
// admin/manager: every case on the challenge (oversight). medical_pro: only
// the cases they authored themselves. Anyone else: 403.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));

    if (isAdmin || isManager) {
      const cases = await caseRepo.findByChallenge(challengeId);
      return NextResponse.json({
        cases: cases.map(c => ({
          id: c.uuid,
          authorUserId: c.author_user_id,
          inputFilename: c.input_filename,
          inputContentType: c.input_content_type,
          createdAt: c.created_at,
        })),
      });
    }

    if (user.role === 'medical_pro') {
      const cases = await caseRepo.findByAuthor(challengeId, user.id);
      return NextResponse.json({
        cases: cases.map(c => ({
          id: c.uuid,
          authorUserId: c.author_user_id,
          inputFilename: c.input_filename,
          inputContentType: c.input_content_type,
          createdAt: c.created_at,
        })),
      });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('Error fetching reference cases:', error);
    return NextResponse.json({ error: 'Failed to fetch reference cases' }, { status: 500 });
  }
}

// POST /api/challenges/[id]/validation-reference-cases — medical_pro only.
// No admin/manager override — per SPEC 3, only a medical_pro writes cases.
// multipart/form-data: input (File), expected_output (File — the client
// wraps typed text in a Blob before appending, so the API only ever handles
// one contract).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'medical_pro') {
      return NextResponse.json({ error: 'Only medical_pro users can author a reference case' }, { status: 403 });
    }

    const { id: challengeId } = await params;
    const form = await req.formData();

    const inputFile = form.get('input');
    const expectedOutputFile = form.get('expected_output');
    if (!(inputFile instanceof File)) {
      return NextResponse.json({ error: 'input is required' }, { status: 400 });
    }
    if (!(expectedOutputFile instanceof File)) {
      return NextResponse.json({ error: 'expected_output is required' }, { status: 400 });
    }
    if (inputFile.size > MAX_UPLOAD_BYTES || expectedOutputFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const created = await service.authorCase({
      validationChallengeId: challengeId,
      authorUserId: user.id,
      input: {
        buffer: Buffer.from(await inputFile.arrayBuffer()),
        filename: inputFile.name,
        contentType: inputFile.type || 'application/octet-stream',
      },
      expectedOutput: {
        buffer: Buffer.from(await expectedOutputFile.arrayBuffer()),
        filename: expectedOutputFile.name || null,
        contentType: expectedOutputFile.type || 'application/octet-stream',
      },
    });

    return NextResponse.json(
      {
        id: created.uuid,
        authorUserId: created.author_user_id,
        inputFilename: created.input_filename,
        inputContentType: created.input_content_type,
        createdAt: created.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof InsufficientRoleError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ReferenceCaseQuotaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error authoring reference case:', error);
    return NextResponse.json({ error: 'Failed to author reference case' }, { status: 500 });
  }
}
