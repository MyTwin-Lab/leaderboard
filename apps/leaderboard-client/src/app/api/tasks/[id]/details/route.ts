import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { TaskDetailsService } from '../../../../../application/task-details.service.js';

const taskDetailsService = new TaskDetailsService();

async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.userId as string;
  } catch {
    return null;
  }
}

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
