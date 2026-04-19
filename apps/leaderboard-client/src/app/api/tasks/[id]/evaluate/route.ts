import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, TaskAssigneeRepository } from '../../../../../../../../packages/database-service/repositories';
import { getSessionFromRequest } from '../../../../../application/auth.js';

const taskRepo = new TaskRepository();
const taskAssigneeRepo = new TaskAssigneeRepository();

async function getTaskEvaluationService() {
  const { TaskEvaluationService } = await import('../../../../../../../../packages/services/task_evaluation/task-evaluation.service');
  return new TaskEvaluationService();
}

export async function POST(
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

    const taskEvaluationService = await getTaskEvaluationService();
    const result = await taskEvaluationService.evaluateTask({
      userId: session.userId,
      taskId,
    });

    return NextResponse.json({
      evaluation: {
        globalScore: result.evaluation.globalScore,
        scores: result.evaluation.scores,
      },
      contribution: result.contribution,
      isUpdate: result.isUpdate,
    });
  } catch (error) {
    console.error('Error evaluating task:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate task' },
      { status: 500 }
    );
  }
}
