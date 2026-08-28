import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository } from '../../../../../../../../packages/database-service/repositories';

const taskRepo = new TaskRepository();

// GET /api/tasks/[id]/details - Récupérer une tâche et ses sous-tâches
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const subTasks = await taskRepo.findSubTasks(taskId);

    return NextResponse.json({ task, subTasks });
  } catch (error) {
    console.error('Error fetching task details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task details' },
      { status: 500 }
    );
  }
}
