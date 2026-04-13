import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, TaskWorkspaceRepository, TaskAssigneeRepository } from '../../../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const taskRepo = new TaskRepository();
const taskWorkspaceRepo = new TaskWorkspaceRepository();
const taskAssigneeRepo = new TaskAssigneeRepository();

type SessionPayload = { userId: string; role: string } | null;

async function getSession(request: NextRequest): Promise<SessionPayload> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch {
    return null;
  }
}

// PATCH /api/tasks/[id]/workspace - Submit a user-provided workspace URL (e.g. Kaggle model/dataset link)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: taskId } = await params;

    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const isAdmin = session.role === 'admin';
    const isAssignee = await taskAssigneeRepo.isUserAssigned(taskId, session.userId);
    if (!isAdmin && !isAssignee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = session.userId;
    const body = await request.json();
    const { repo_id, workspace_url } = body;

    if (!repo_id || typeof repo_id !== 'string') {
      return NextResponse.json({ error: 'repo_id is required' }, { status: 400 });
    }
    if (!workspace_url || typeof workspace_url !== 'string') {
      return NextResponse.json({ error: 'workspace_url is required' }, { status: 400 });
    }

    const workspace = await taskWorkspaceRepo.findByTaskAndRepo(taskId, repo_id);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Merge the user's URL into workspace_meta.userUrls — keeps per-user URLs on concurrent tasks
    const existingMeta = (workspace.workspace_meta as Record<string, unknown>) ?? {};
    const existingUserUrls = (existingMeta.userUrls as Record<string, string>) ?? {};
    const updatedMeta = {
      ...existingMeta,
      userUrls: { ...existingUserUrls, [userId]: workspace_url },
    };

    const updated = await taskWorkspaceRepo.updateWorkspace(taskId, repo_id, {
      workspace_status: 'ready',
      workspace_meta: updatedMeta,
    });

    return NextResponse.json({ workspace: updated });
  } catch (error) {
    console.error('Error updating workspace URL:', error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}
