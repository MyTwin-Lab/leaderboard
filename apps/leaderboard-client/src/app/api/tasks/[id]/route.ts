import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, ChallengeRepository, ChallengeTeamRepository } from '../../../../../../../packages/database-service/repositories';
import { repositories } from '@/lib/db';
import { resolveWorkspaceOwner } from '../../../../../../../packages/services/challenge/group';
import { jwtVerify } from 'jose';
import { z } from 'zod';

const taskRepo = new TaskRepository();
const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

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
  /**
   * Statut depuis lequel le client croit déplacer la carte. Facultatif : sans
   * lui l'écriture reste inconditionnelle, comme avant. Avec lui, un board de
   * groupe ne peut plus perdre silencieusement le déplacement d'un membre.
   */
  from_status: z.enum(['todo', 'in_progress', 'done']).optional(),
});

async function canTouchTask(request: NextRequest, taskId: string):
  Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const session = await getSession(request);
  if (!session) return { ok: false, status: 401, error: 'Authentication required' };
  const task = await taskRepo.findById(taskId);
  if (!task) return { ok: false, status: 404, error: 'Task not found' };

  if (task.user_id) {
    // La tâche appartient au board, et le board appartient au groupe : on
    // compare au porteur, pas à l'appelant. Pour un solo les deux coïncident,
    // et quelqu'un d'étranger au challenge reste son propre porteur — donc
    // toujours refusé.
    const boardOwnerId = await resolveWorkspaceOwner(task.challenge_id, session.userId, { challengeTeamRepo });
    if (task.user_id !== boardOwnerId && session.role !== 'admin') {
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
    const { from_status: fromStatus, ...validated } = updateTaskSchema.parse(body);

    if (validated.parent_task_id) {
      const [current, parent] = await Promise.all([
        taskRepo.findById(id),
        taskRepo.findById(validated.parent_task_id),
      ]);
      if (!parent || !current || parent.challenge_id !== current.challenge_id || parent.user_id !== current.user_id) {
        return NextResponse.json({ error: 'Parent task is not in the same scope' }, { status: 400 });
      }
    }

    const task = await taskRepo.update(id, validated, { expectedStatus: fromStatus });
    if (!task) {
      // Quelqu'un a bougé la carte entre le chargement de l'écran et ce clic.
      // On renvoie l'état réel pour que le client annule son déplacement
      // optimiste et dise ce qui s'est passé, plutôt que d'écraser en silence.
      const current = await taskRepo.findById(id);
      return NextResponse.json(
        { error: 'This task was moved by someone else', task: current },
        { status: 409 }
      );
    }
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
