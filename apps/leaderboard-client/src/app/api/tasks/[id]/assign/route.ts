import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, TaskAssigneeRepository } from '../../../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const taskRepo = new TaskRepository();
const taskAssigneeRepo = new TaskAssigneeRepository();

// Extraire l'userId du token JWT
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

// POST /api/tasks/[id]/assign - S'assigner à une tâche
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;

    // Vérifier que la tâche existe
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Vérifier si l'utilisateur est déjà assigné
    const alreadyAssigned = await taskAssigneeRepo.isUserAssigned(taskId, userId);
    if (alreadyAssigned) {
      return NextResponse.json(
        { error: 'You are already assigned to this task' },
        { status: 400 }
      );
    }

    // Si la tâche est "solo", vérifier qu'il n'y a pas déjà quelqu'un d'assigné
    if (task.type === 'solo') {
      const assigneeCount = await taskAssigneeRepo.countAssignees(taskId);
      if (assigneeCount > 0) {
        return NextResponse.json(
          { error: 'This is a solo task and someone is already assigned' },
          { status: 400 }
        );
      }
    }

    // Assigner l'utilisateur
    const assignment = await taskAssigneeRepo.assignUser(taskId, userId);
    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error assigning to task:', error);
    return NextResponse.json(
      { error: 'Failed to assign to task' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id]/assign - Se désassigner d'une tâche
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;

    // Vérifier que la tâche existe
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Vérifier si l'utilisateur est assigné
    const isAssigned = await taskAssigneeRepo.isUserAssigned(taskId, userId);
    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this task' },
        { status: 400 }
      );
    }

    // Désassigner l'utilisateur
    await taskAssigneeRepo.unassignUser(taskId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unassigning from task:', error);
    return NextResponse.json(
      { error: 'Failed to unassign from task' },
      { status: 500 }
    );
  }
}
