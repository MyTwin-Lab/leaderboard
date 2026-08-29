import { NextRequest, NextResponse } from 'next/server';
import { ChallengeDocumentRepository } from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const docRepo = new ChallengeDocumentRepository();

// GET /api/challenges/[id]/documents — public read
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const docs = await docRepo.findByChallengeId(id);
    return NextResponse.json(docs);
  } catch (err) {
    console.error('Error fetching documents:', err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST /api/challenges/[id]/documents — admin only
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && await isManagerOfChallenge(user.id, id);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const { filename, content } = body as { filename?: string; content?: string };

    if (!filename || typeof filename !== 'string' || !filename.endsWith('.md')) {
      return NextResponse.json({ error: 'Only .md files are allowed' }, { status: 400 });
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    if (content.length > 500_000) {
      return NextResponse.json({ error: 'File too large (max 500KB)' }, { status: 400 });
    }

    const doc = await docRepo.create({
      challenge_id: id,
      filename,
      content,
      uploaded_by: user.id,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('Error creating document:', err);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}
