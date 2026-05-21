import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, TaskAssigneeRepository, ContributionRepository } from '../../../../../../../../packages/database-service/repositories';
import { getSessionFromRequest } from '../../../../../application/auth.js';

const taskRepo = new TaskRepository();
const taskAssigneeRepo = new TaskAssigneeRepository();
const contributionRepo = new ContributionRepository();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;
    const task = await taskRepo.findById(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const isAdmin = session.role === 'admin';
    const isAssignee = await taskAssigneeRepo.isUserAssigned(taskId, session.userId);

    if (!isAdmin && !isAssignee) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const taskContributions = await contributionRepo.findByTask(taskId);
    const hasEvaluation = taskContributions.some(c => c.evaluation != null);
    if (!hasEvaluation) {
      return NextResponse.json(
        { error: 'Task must have at least one evaluated contribution before being marked as done' },
        { status: 400 }
      );
    }

    const updatedTask = await taskRepo.completeTask(taskId);
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json(
      { error: 'Failed to complete task' },
      { status: 500 }
    );
  }
}
