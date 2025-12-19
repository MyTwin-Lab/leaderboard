import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, TaskAssigneeRepository } from '../../../../../../../../packages/database-service/repositories';

const taskRepo = new TaskRepository();
const taskAssigneeRepo = new TaskAssigneeRepository();

// GET /api/tasks/[id]/assignees - Récupérer les utilisateurs assignés à une tâche
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    // Vérifier que la tâche existe
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Récupérer les assignés
    const assignees = await taskAssigneeRepo.findAssignees(taskId);
    return NextResponse.json(assignees);
  } catch (error) {
    console.error('Error fetching task assignees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignees' },
      { status: 500 }
    );
  }
}
