import { NextRequest, NextResponse } from 'next/server';
import { TaskDetailsService } from '../../../../../application/task-details.service.js';
import { getUserIdFromRequest } from '../../../../../application/auth.js';

const taskDetailsService = new TaskDetailsService();

// GET /api/tasks/[id]/details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(request);
  const { id: taskId } = await params;
  try {
    const details = await taskDetailsService.getDetails(taskId, userId);
    return NextResponse.json(details);
  } catch (error: any) {
    const status = error?.status ?? 500;
    if (status === 404) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    console.error('Error fetching task details:', error);
    return NextResponse.json({ error: 'Failed to fetch task details' }, { status: 500 });
  }
}
