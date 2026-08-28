import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, ChallengeRepository } from '../../../../../../../packages/database-service/repositories';
import { repositories } from '@/lib/db';
import { jwtVerify } from 'jose';
import { z } from 'zod';

const taskRepo = new TaskRepository();
const challengeRepo = new ChallengeRepository();

async function getSession(request: NextRequest) {
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

async function isChallengeManager(session: { userId: string; role: string }, challengeProjectId: string) {
  if (session.role === 'admin') return true;
  const project = await repositories.project.findById(challengeProjectId);
  return !!project && project.manager_id === session.userId;
}

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
});

async function canTouchTask(request: NextRequest, taskId: string):
  Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const session = await getSession(request);
  if (!session) return { ok: false, status: 401, error: 'Authentication required' };
  const task = await taskRepo.findById(taskId);
  if (!task) return { ok: false, status: 404, error: 'Task not found' };

  if (task.user_id) {
    if (task.user_id !== session.userId && session.role !== 'admin') {
      return { ok: false, status: 403, error: 'Not your task' };
    }
    return { ok: true };
  }
  // Tâche template — réservée au manager/admin du challenge.
  const challenge = await challengeRepo.findById(task.challenge_id);
  if (!challenge) return { ok: false, status: 404, error: 'Challenge not found' };
  if (!(await isChallengeManager(session, challenge.project_id))) {
    return { ok: false, status: 403, error: 'Only the challenge manager can edit the template' };
  }
  return { ok: true };
}

// GET /api/tasks/[id] - Récupérer une tâche
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await taskRepo.findById(id);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] - Mettre à jour une tâche (propriétaire, ou admin/manager pour une template)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await canTouchTask(request, id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const validated = updateTaskSchema.parse(body);

    const task = await taskRepo.update(id, {
      ...validated,
      // TaskRepository.update (Task 3) doesn't accept null for parent_task_id yet
      // (its schema only allows string|undefined); treat an explicit "clear" as a
      // no-op until the repo/schema support unlinking a sub-task from its parent.
      parent_task_id: validated.parent_task_id ?? undefined,
    });
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Supprimer une tâche (propriétaire, ou admin/manager pour une template)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await canTouchTask(request, id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    await taskRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
