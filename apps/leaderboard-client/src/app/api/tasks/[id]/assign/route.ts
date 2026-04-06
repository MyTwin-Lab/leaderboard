import { NextRequest, NextResponse } from 'next/server';
import { TaskAssignService } from '../../../../../application/task-assign.service.js';
import { getUserIdFromRequest } from '../../../../../application/auth.js';

const taskAssignService = new TaskAssignService();

// POST /api/tasks/[id]/assign - S'assigner à une tâche
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { id: taskId } = await params;
  try {
    const result = await taskAssignService.assign(taskId, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? 500;
    if (status < 500) return NextResponse.json({ error: error.message }, { status });
    console.error('Error assigning to task:', error);
    return NextResponse.json({ error: 'Failed to assign to task' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id]/assign - Se désassigner d'une tâche
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { id: taskId } = await params;
  try {
    await taskAssignService.unassign(taskId, userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error?.status ?? 500;
    if (status < 500) return NextResponse.json({ error: error.message }, { status });
    console.error('Error unassigning from task:', error);
    return NextResponse.json({ error: 'Failed to unassign from task' }, { status: 500 });
  }
}
