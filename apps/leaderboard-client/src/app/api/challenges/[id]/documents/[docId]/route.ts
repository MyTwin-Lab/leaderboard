import { NextRequest, NextResponse } from 'next/server';
import { ChallengeDocumentRepository } from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const docRepo = new ChallengeDocumentRepository();

// DELETE /api/challenges/[id]/documents/[docId] — admin only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id, docId } = await params;
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && await isManagerOfChallenge(user.id, id);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const doc = await docRepo.findById(docId);

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (doc.challenge_id !== id) {
      return NextResponse.json({ error: 'Document does not belong to this challenge' }, { status: 400 });
    }

    await docRepo.delete(docId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting document:', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
