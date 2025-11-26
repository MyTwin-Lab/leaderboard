import { NextRequest, NextResponse } from 'next/server';
import { RepoRepository } from '../../../../../../../packages/database-service/repositories';

const repoRepo = new RepoRepository();

// DELETE /api/repos/[id] - Supprimer un repo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await repoRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting repo:', error);
    return NextResponse.json(
      { error: 'Failed to delete repo' },
      { status: 500 }
    );
  }
}
