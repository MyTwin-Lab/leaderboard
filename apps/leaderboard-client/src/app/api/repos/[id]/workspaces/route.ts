import { NextRequest, NextResponse } from 'next/server';
import { TaskWorkspaceRepository } from '../../../../../../../../packages/database-service/repositories';

const taskWorkspaceRepo = new TaskWorkspaceRepository();

// GET /api/repos/[id]/workspaces - Récupérer les task_workspaces liés à un repo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaces = await taskWorkspaceRepo.findByRepoWithAssignees(id);
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('Error fetching repo workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repo workspaces' },
      { status: 500 }
    );
  }
}
